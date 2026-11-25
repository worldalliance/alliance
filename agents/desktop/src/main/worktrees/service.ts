import { R, type Result } from "../../../../../common/src/result";
import type { CreatedWorktree } from "../../shared/ipc";
import type { Problem } from "../../shared/repository";
import {
  CreationStage,
  nameBase,
  newWorktreeKey,
  type Worktree,
  type WorktreesState,
  WorktreesStatus,
  WorktreeStatus,
} from "../../shared/worktree";
import { fetchMain } from "../repository/fetch";
import type { Git } from "../repository/git";
import { localBranches, runNewWorktree, worktreeName } from "./create";
import { type Bun, type ListedWorktree, listWorktrees } from "./list";
import { listedWorktrees } from "./listed-worktrees";
import type { SavedWorktree, WorktreeStore } from "./store";

type Creation = {
  key: string;
  typed: string;
  /** The name before numbering past taken ones. */
  base: string;
  /** Set once chosen, so a listing shows the worktree as this creation rather than as a worktree of its own. */
  name?: string;
  /** Names earlier attempts used. The script can refuse a name before leaving anything that marks it taken, such as when its folder exists. */
  tried: string[];
  /** Set once scripts/new-worktree.sh has created the worktree, so Try again looks for it rather than creating another. */
  made?: boolean;
  worktree: Worktree;
  controller: AbortController;
};

/** Lists the repository's worktrees, and creates, archives and restores them. Each worktree's conversations are the ones whose folder is its folder. */
export class WorktreeService {
  private state: WorktreesState = {
    status: WorktreesStatus.NoRepository,
    worktrees: [],
    created: {},
  };
  private readonly listeners = new Set<(state: WorktreesState) => void>();
  private listed: ListedWorktree[] = [];
  private saved: SavedWorktree[] = [];
  private readonly creations = new Map<string, Creation>();
  private running = new Set<Promise<unknown>>();
  private listing: Promise<void> | undefined;
  private listAgain = false;
  // Counts the saved changes shown before a listing read them back, so a listing that began before one doesn't hide it.
  private savedChanges = 0;
  private readonly archiving = new Set<string>();
  private closed = false;

  constructor(
    private readonly params: {
      /** The main checkout, while there is a usable one. */
      checkout: () => string | undefined;
      repositoryUrl: string;
      findGit: () => Promise<Result<Git, string>>;
      findBun: () => Promise<Result<Bun, Error>>;
      store: WorktreeStore;
      /** Closes the app's sessions in folder, resolving once their CLIs have exited. */
      closeSessionsIn: (folder: string) => Promise<void>;
    },
  ) {}

  current(): WorktreesState {
    return this.state;
  }

  subscribe(listener: (state: WorktreesState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Lists the worktrees again; a call while a listing runs lists once more after it. */
  refresh(): Promise<void> {
    if (this.listing) {
      this.listAgain = true;
      return this.listing;
    }
    this.listing = (async () => {
      do {
        this.listAgain = false;
        await this.listNow();
      } while (this.listAgain && !this.closed);
    })().finally(() => (this.listing = undefined));
    return this.listing;
  }

  private async listNow(): Promise<void> {
    const checkout = this.params.checkout();
    if (!checkout) {
      this.listed = [];
      return this.publish({
        status: WorktreesStatus.NoRepository,
        problem: undefined,
      });
    }
    if (this.state.status === WorktreesStatus.NoRepository)
      this.publish({ status: WorktreesStatus.Loading });
    const changes = this.savedChanges;
    const [listed, saved] = await Promise.all([
      this.list(checkout),
      this.params.store.list(),
    ]);
    if (saved.ok && changes === this.savedChanges) this.saved = saved.value;
    else if (saved.ok) this.listAgain = true;
    if (listed.ok) this.listed = listed.value;
    const problem = !listed.ok
      ? {
          message: "Alliance agent couldn't list your worktrees.",
          details: listed.error.message,
        }
      : !saved.ok
        ? {
            message:
              "Alliance agent couldn't read which worktrees are archived.",
            details: saved.error.message,
          }
        : undefined;
    this.publish({
      status:
        listed.ok || this.state.status === WorktreesStatus.Listed
          ? WorktreesStatus.Listed
          : WorktreesStatus.Loading,
      problem,
    });
  }

  private async list(
    checkout: string,
  ): Promise<Result<ListedWorktree[], Error>> {
    const bun = await this.params.findBun();
    return bun.ok ? listWorktrees({ bun: bun.value, checkout }) : bun;
  }

  /** Creates a worktree named after input.name. Fails when that has no letter from a to z or digit, or when the worktree couldn't be created, leaving the creation in the list with what went wrong until it is retried or dismissed. */
  create(input: {
    creationId: string;
    name: string;
  }): Promise<Result<CreatedWorktree, Problem>> {
    const key = newWorktreeKey(input.creationId);
    if (this.creations.has(key))
      return Promise.resolve(
        R.failure({ message: "This worktree is already being created." }),
      );
    const base = nameBase(input.name);
    if (!base)
      return Promise.resolve(
        R.failure({
          message: "A worktree name needs a letter from a to z or a digit.",
        }),
      );
    return this.run({
      key,
      typed: input.name,
      base,
      tried: [],
      controller: new AbortController(),
      worktree: creatingWorktree({
        key,
        name: base,
        stage: CreationStage.Downloading,
      }),
    });
  }

  /** Creates a failed creation's worktree again, under a new name. */
  retry(key: string): Promise<Result<CreatedWorktree, Problem>> {
    const failed = this.creations.get(key);
    if (failed?.worktree.state.status !== WorktreeStatus.CreateFailed)
      return Promise.resolve(
        R.failure({
          message: "This worktree isn't waiting to be tried again.",
        }),
      );
    return this.run({
      ...failed,
      ...(!failed.made && {
        name: undefined,
        tried: failed.name ? [...failed.tried, failed.name] : failed.tried,
      }),
      controller: new AbortController(),
      worktree: creatingWorktree({
        key: failed.key,
        name: failed.made && failed.name ? failed.name : failed.base,
        stage: failed.made ? CreationStage.Finding : CreationStage.Downloading,
      }),
    });
  }

  /** Forgets a failed creation that made no worktree; what it left behind stays listed. */
  dismiss(key: string): void {
    const failed = this.creations.get(key);
    if (
      failed?.worktree.state.status !== WorktreeStatus.CreateFailed ||
      failed.made
    )
      return;
    this.creations.delete(key);
    this.publish({});
  }

  private run(creation: Creation): Promise<Result<CreatedWorktree, Problem>> {
    if (this.closed)
      return Promise.resolve(
        R.failure({ message: "Alliance agent is quitting." }),
      );
    this.creations.set(creation.key, creation);
    this.publish({});
    const done = this.createNow(creation).then((result) => {
      if (result.ok) {
        this.creations.delete(creation.key);
        this.publish({
          created: { ...this.state.created, [creation.key]: result.value.key },
        });
      } else
        this.setCreation(creation, {
          status: WorktreeStatus.CreateFailed,
          problem: result.error.problem,
          leftover: result.error.leftover,
          made: !!creation.made,
          typed: creation.typed,
        });
      return R.mapError(result, ({ problem }) => problem);
    });
    this.running.add(done);
    void done.finally(() => this.running.delete(done));
    return done;
  }

  private setCreation(creation: Creation, state: Worktree["state"]): void {
    creation.worktree = { ...creation.worktree, state };
    this.publish({});
  }

  private async makeWorktree(params: {
    creation: Creation;
    checkout: string;
  }): Promise<Result<void, { problem: Problem; leftover?: string }>> {
    const { creation, checkout } = params;
    const { signal } = creation.controller;
    const git = await this.params.findGit();
    if (!git.ok) return R.failure({ problem: { message: git.error } });
    const from = await fetchMain({
      git: git.value,
      checkout,
      url: this.params.repositoryUrl,
      signal,
    });
    if (!from.ok) return R.failure({ problem: from.error });
    const [listed, branches] = await Promise.all([
      this.list(checkout),
      localBranches(git.value, checkout),
    ]);
    if (!listed.ok || !branches.ok)
      return R.failure({
        problem: {
          message:
            "Alliance agent couldn't check which worktree names are taken.",
          details: [listed, branches]
            .flatMap((read) => (read.ok ? [] : [read.error.message]))
            .join("\n"),
        },
      });
    const taken = new Set([
      ...listed.value.flatMap(({ name }) => (name ? [name] : [])),
      ...branches.value,
      ...creation.tried,
      ...[...this.creations.values()].flatMap(({ name }) =>
        name ? [name] : [],
      ),
    ]);
    // No await may separate reading the other creations' names from recording this one, so two creations can't choose the same name.
    const name = worktreeName(creation.base, taken);
    creation.name = name;
    creation.worktree = { ...creation.worktree, name };
    this.setCreation(creation, {
      status: WorktreeStatus.Creating,
      stage: CreationStage.CopyingDatabase,
    });
    const made = await runNewWorktree({
      checkout,
      name,
      from: from.value,
      signal,
      onStage: (stage) =>
        this.setCreation(creation, { status: WorktreeStatus.Creating, stage }),
    });
    if (made.ok) return R.success(undefined);
    const relisted = await this.list(checkout);
    const worktree = relisted.ok
      ? relisted.value.find((w) => w.name === name)
      : undefined;
    if (relisted.ok) await this.refresh();
    return R.failure({
      problem: made.error,
      leftover: !relisted.ok
        ? `Alliance agent couldn't check whether part of it was created: ${relisted.error.message}. scripts/list-worktrees.ts, run in Terminal from ${checkout}, shows it.`
        : worktree
          ? `Part of it was created: ${worktree.path ?? `a record named ${name}`}. Alliance agent can't remove that yet; scripts/rm-worktree.sh ${name}, run in Terminal from ${checkout}, does.`
          : undefined,
    });
  }

  private async createNow(
    creation: Creation,
  ): Promise<Result<CreatedWorktree, { problem: Problem; leftover?: string }>> {
    const checkout = this.params.checkout();
    if (!checkout)
      return R.failure({
        problem: {
          message:
            "Alliance agent needs the Alliance repository to be ready to create a worktree. Try again once it is.",
        },
        leftover: creation.made ? madeLeftover(creation.name) : undefined,
      });
    if (!creation.made) {
      const made = await this.makeWorktree({ creation, checkout });
      if (!made.ok) return made;
      creation.made = true;
    }
    // The sidebar's listing can be of no checkout or another one by now, so only this one's says whether the worktree is there.
    const listed = await this.list(checkout);
    const name = creation.name;
    const leftover = madeLeftover(name);
    const worktree = listed.ok
      ? listed.value.find((w) => w.name === name)
      : undefined;
    if (!worktree?.path || !worktree.id) {
      // A worktree a successful listing doesn't show is gone, so Try again makes another and the creation can be edited or dismissed.
      const gone = listed.ok && !worktree;
      if (gone) creation.made = false;
      return R.failure({
        problem: {
          message: `scripts/new-worktree.sh created ${name}, but Alliance agent couldn't find it in the worktree list.`,
          details: listed.ok ? undefined : listed.error.message,
        },
        leftover: gone ? undefined : leftover,
      });
    }
    await this.refresh();
    return R.success({ key: worktree.id, folder: worktree.path });
  }

  /** Saves the worktree as archived, then stops its agents and hides it; a failed save stops nothing. */
  async archive(key: string): Promise<Result<void, Error>> {
    const worktree = this.state.worktrees.find((t) => t.key === key);
    if (!worktree || this.creations.has(key))
      return R.failure(new Error("Only a listed worktree can be archived."));
    if (this.archiving.has(key)) return stillArchiving();
    const change = (saved: SavedWorktree): SavedWorktree => ({
      ...saved,
      archived: true,
      folder: worktree.folder,
    });
    this.archiving.add(key);
    const saved = await this.params.store.update(key, change);
    if (!saved.ok) {
      this.archiving.delete(key);
      return saved;
    }
    if (worktree.folder) await this.params.closeSessionsIn(worktree.folder);
    this.archiving.delete(key);
    this.showSaved(key, change);
    return saved;
  }

  /** Whether folder is that of a worktree that is archived or being archived. The listing decides for a folder it lists; for any other, such as one before the worktrees are listed or in a checkout the app no longer points at, the folders saved on archiving decide. */
  async isArchived(folder: string): Promise<boolean> {
    const worktree =
      this.state.status === WorktreesStatus.Listed
        ? this.state.worktrees.find((t) => t.folder === folder)
        : undefined;
    if (worktree) return worktree.archived || this.archiving.has(worktree.key);
    const saved = await this.params.store.list();
    return (
      saved.ok && saved.value.some((t) => t.archived && t.folder === folder)
    );
  }

  async restore(key: string): Promise<Result<void, Error>> {
    if (this.archiving.has(key)) return stillArchiving();
    const change = (saved: SavedWorktree): SavedWorktree => ({
      ...saved,
      archived: false,
    });
    const saved = await this.params.store.update(key, change);
    if (saved.ok) this.showSaved(key, change);
    return saved;
  }

  /** Publishes a change already saved to the store, without waiting for a listing to read it back. */
  private showSaved(
    key: string,
    change: (worktree: SavedWorktree) => SavedWorktree,
  ): void {
    const old = this.saved.find((saved) => saved.key === key);
    this.saved = [
      ...this.saved.filter((saved) => saved !== old),
      change(old ?? { key }),
    ];
    this.savedChanges++;
    this.publish({});
  }

  /** Aborts creations in progress and waits for their scripts to exit; a step a script was running can outlive it (ALL-2391). */
  async close(): Promise<void> {
    this.closed = true;
    for (const creation of this.creations.values()) creation.controller.abort();
    await Promise.allSettled(this.running);
    await this.listing;
  }

  private publish(change: Partial<WorktreesState>): void {
    const next = { ...this.state, ...change };
    this.state = {
      ...next,
      worktrees: [
        ...[...this.creations.values()].map(({ worktree }) => worktree),
        ...listedWorktrees({
          listed: this.listed,
          saved: this.saved,
          archiving: this.archiving,
          creating: new Set(
            [...this.creations.values()].flatMap(({ name }) =>
              name ? [name] : [],
            ),
          ),
        }),
      ],
    };
    for (const listener of this.listeners) listener(this.state);
  }
}

const madeLeftover = (name: string | undefined) =>
  `${name} was created. Try again uses it rather than creating another.`;

const stillArchiving = () =>
  R.failure(
    new Error("This worktree is still being archived. Try again in a moment."),
  );

const creatingWorktree = (params: {
  key: string;
  name: string;
  stage: CreationStage;
}): Worktree => ({
  key: params.key,
  name: params.name,
  archived: false,
  state: { status: WorktreeStatus.Creating, stage: params.stage },
});
