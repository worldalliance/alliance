import { access, realpath } from "node:fs/promises";
import path from "node:path";
import { R, type Result } from "../../../../../common/src/result";
import {
  ClonePhase,
  type Problem,
  type RepositoryState,
  RepositoryStatus,
} from "../../shared/repository";
import { failureOutput } from "../agent/cli-process";
import { cloneInto, isFreeFolder, stallLimit } from "./clone";
import type { Git } from "./git";
import {
  fetchTarget,
  FolderProblemKind,
  type Identified,
  identify,
  updateBlocker,
} from "./identify";
import { type SavedChoice, SavedKind, type SavedRepository } from "./saved";
import type { RepositorySource } from "./source";

type Running = { controller: AbortController; done: Promise<void> };

/** Finds, clones and updates the checkout the app works on, and reports its state to subscribers. Lookups and the user's operations run one after another; a later one cancels a clone in progress. */
export class RepositoryService {
  private state: RepositoryState = { status: RepositoryStatus.Checking };
  private readonly listeners = new Set<(state: RepositoryState) => void>();
  private git: Git | undefined;
  private running: Running | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(
    private readonly params: {
      source: RepositorySource;
      saved: SavedRepository;
      /** The checkout an unpackaged app runs from, tried after the saved choice. */
      ownCheckout?: string;
      findGit: () => Promise<Result<Git, string>>;
    },
  ) {}

  current(): RepositoryState {
    return this.state;
  }

  subscribe(listener: (state: RepositoryState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Looks for the checkout: the saved copy or a copy in the saved clone folder, then the app's own checkout, then the default folder, which it clones into when that is free, autoClone is set and the user hasn't chosen a clone folder. Does nothing while a clone or update runs. */
  locate(params: { autoClone: boolean }): Promise<void> {
    return this.exclusive(() => this.locateNow(params));
  }

  /** Looks again, cloning as launch would only when leaving "Needs Git", which kept launch from cloning. */
  checkAgain(): Promise<void> {
    return this.exclusive(() =>
      this.locateNow({
        autoClone: this.state.status === RepositoryStatus.GitMissing,
      }),
    );
  }

  private async locateNow(params: { autoClone: boolean }): Promise<void> {
    if (this.running || this.closed) return;
    this.set({ status: RepositoryStatus.Checking });
    const git = await this.findGit();
    if (!git.ok)
      return this.set({
        status: RepositoryStatus.GitMissing,
        message: git.error,
      });
    const { source, saved } = this.params;
    const chosen = await saved.read();
    const cloneFolder =
      chosen.ok && chosen.value?.kind === SavedKind.CloneFolder
        ? chosen.value.folder
        : undefined;
    const notSetUp = (problem?: Problem): RepositoryState => ({
      status: RepositoryStatus.NotSetUp,
      cloneFolder: cloneFolder ?? source.defaultFolder,
      problem,
    });

    if (!chosen.ok)
      return this.set(
        notSetUp({
          message:
            "Alliance agent couldn't read which copy of the repository you chose.",
          details: chosen.error.message,
        }),
      );
    if (chosen.value?.kind === SavedKind.Copy) {
      const found = await identify({
        git: git.value,
        source,
        folder: chosen.value.folder,
      });
      if (found.ok) return this.set(identifiedState(found.value));
      return this.set(
        notSetUp(
          found.error.kind === FolderProblemKind.Missing
            ? {
                message: `The Alliance repository at ${chosen.value.folder} is gone. Clone it again or use an existing copy.`,
              }
            : found.error,
        ),
      );
    }

    // A clone whose save as the user's copy failed, or was cut short, is still found.
    if (cloneFolder) {
      const cloned = await copyAt({
        git: git.value,
        source,
        folder: cloneFolder,
      });
      if (cloned) return this.set(identifiedState(cloned));
    }

    if (this.params.ownCheckout) {
      const own = await identify({
        git: git.value,
        source,
        folder: this.params.ownCheckout,
      });
      if (own.ok) return this.set(identifiedState(own.value));
      console.error(
        `The checkout Alliance agent runs from isn't usable: ${own.error.message}`,
      );
    }

    const free = await isFreeFolder(source.defaultFolder);
    if (!free.ok)
      return this.set(
        notSetUp({
          message: `Alliance agent can't open ${source.defaultFolder}.`,
          details: free.error.message,
        }),
      );
    if (free.value)
      return params.autoClone && !cloneFolder
        ? this.startClone(git.value, source.defaultFolder)
        : this.set(notSetUp());
    const found = await copyAt({
      git: git.value,
      source,
      folder: source.defaultFolder,
    });
    if (found) return this.set(identifiedState(found));
    this.set(
      notSetUp(
        cloneFolder
          ? undefined
          : {
              message: `${source.defaultFolder} already has other files in it. Choose another folder to clone into, or use an existing copy.`,
            },
      ),
    );
  }

  /** Clones into the folder the state names. */
  clone(): Promise<Result<void, Problem>> {
    return this.exclusive(async () => {
      if (this.state.status !== RepositoryStatus.NotSetUp)
        return R.failure({
          message: "The repository isn't waiting to be cloned.",
        });
      const { cloneFolder } = this.state;
      const git = await this.findGit();
      if (!git.ok) return R.failure({ message: git.error });
      await this.startClone(git.value, cloneFolder);
      return R.success(undefined);
    });
  }

  /** Makes picked, or a new folder named after the repository inside it when picked has files, the saved folder to clone into, restarting a clone in progress there. Refuses a folder in a copy of the repository, or a copy itself, which would nest a second copy or clone over one. */
  changeCloneFolder(picked: string): Promise<Result<void, Problem>> {
    return this.exclusive(async () => {
      const free = await isFreeFolder(picked);
      if (!free.ok)
        return R.failure({
          message: `Alliance agent can't open ${picked}.`,
          details: free.error.message,
        });
      const folder = free.value
        ? picked
        : path.join(picked, path.basename(this.params.source.defaultFolder));
      const git = await this.findGit();
      if (!git.ok) return R.failure({ message: git.error });
      const copy = await identify({
        git: git.value,
        source: this.params.source,
        folder: await nearestExisting(picked),
      });
      if (copy.ok)
        return R.failure({
          message: `${picked} is already in a copy of the Alliance repository. Use existing copy instead.`,
        });
      if (!free.value) {
        const inner = await isFreeFolder(folder);
        if (!inner.ok || !inner.value) {
          const isCopy = (
            await identify({
              git: git.value,
              source: this.params.source,
              folder,
            })
          ).ok;
          return R.failure({
            message: isCopy
              ? `${folder} is already a copy of the Alliance repository. Use existing copy instead.`
              : `${folder} already has files in it. Choose an empty folder to clone into.`,
          });
        }
      }
      await this.stopRunning();
      // A clone that git finished before the change landed is kept and has set its own state.
      const { state } = this;
      if (
        state.status !== RepositoryStatus.Cloning &&
        state.status !== RepositoryStatus.NotSetUp
      )
        return R.failure({
          message: "The repository isn't waiting to be cloned.",
        });
      const saved = await this.save({ kind: SavedKind.CloneFolder, folder });
      if (!saved.ok) {
        if (state.status === RepositoryStatus.Cloning)
          this.set({
            status: RepositoryStatus.NotSetUp,
            cloneFolder: state.folder,
          });
        return saved;
      }
      if (state.status === RepositoryStatus.Cloning) {
        const git = await this.findGit();
        if (!git.ok) return R.failure({ message: git.error });
        await this.startClone(git.value, folder);
        return R.success(undefined);
      }
      this.set({ status: RepositoryStatus.NotSetUp, cloneFolder: folder });
      return R.success(undefined);
    });
  }

  /** Stops a clone in progress and saves its folder, so the next launch waits for the user to clone. */
  cancelClone(): Promise<void> {
    return this.exclusive(async () => {
      if (this.state.status !== RepositoryStatus.Cloning) return;
      const { folder } = this.state;
      await this.stopRunning();
      // A clone that git finished before the cancel landed is kept and has set its own state.
      if (this.state.status !== RepositoryStatus.Cloning) return;
      const saved = await this.save({ kind: SavedKind.CloneFolder, folder });
      this.set({
        status: RepositoryStatus.NotSetUp,
        cloneFolder: folder,
        problem: saved.ok ? undefined : saved.error,
      });
    });
  }

  /** Uses the copy that contains picked, saving it as the user's choice. A clone in progress stops once the copy checks out. */
  useExisting(picked: string): Promise<Result<void, Problem>> {
    return this.exclusive(async () => {
      const git = await this.findGit();
      if (!git.ok) return R.failure({ message: git.error });
      const found = await identify({
        git: git.value,
        source: this.params.source,
        folder: picked,
      });
      if (!found.ok) return R.failure(found.error);
      if (this.state.status === RepositoryStatus.Updating)
        return R.failure({ message: "Wait for the update to finish first." });
      await this.stopRunning();
      const saved = await this.save({
        kind: SavedKind.Copy,
        folder: found.value.folder,
      });
      if (!saved.ok) return saved;
      this.set(identifiedState(found.value));
      return R.success(undefined);
    });
  }

  /** Fast-forwards an outdated copy that is on main with nothing uncommitted to the source's latest main. */
  async update(): Promise<Result<void, Problem>> {
    const started = await this.exclusive(() => this.startUpdate());
    if (!started.ok) return started;
    await started.value;
    return R.success(undefined);
  }

  /** Stops an update's download, leaving the copy outdated; once git is fast-forwarding, the update finishes. */
  cancelUpdate(): void {
    if (this.state.status === RepositoryStatus.Updating)
      this.running?.controller.abort();
  }

  /** Stops a clone or update in progress, waiting for git to exit and a partial clone to be removed, and refuses later operations. */
  async close(): Promise<void> {
    this.closed = true;
    await this.stopRunning();
  }

  private async startUpdate(): Promise<Result<Promise<void>, Problem>> {
    const state = this.state;
    if (state.status !== RepositoryStatus.UpdateNeeded || state.blocker)
      return R.failure({
        message: "This copy can't be updated by Alliance agent.",
      });
    const git = await this.findGit();
    if (!git.ok) return R.failure({ message: git.error });
    const { folder } = state;
    const controller = new AbortController();
    this.set({ status: RepositoryStatus.Updating, folder });
    const done = (async () => {
      const failed = (problem?: Problem) =>
        this.set({ status: RepositoryStatus.UpdateNeeded, folder, problem });
      const target = await fetchTarget({
        git: git.value,
        folder,
        url: this.params.source.url,
      });
      if (controller.signal.aborted) return failed();
      if (!target.ok)
        return failed({
          message: `Alliance agent couldn't check ${folder}.`,
          details: target.error.message,
        });
      const fetched = await git.value.run({
        args: ["-C", folder, ...stallLimit, "fetch", target.value, "main"],
        signal: controller.signal,
      });
      if (controller.signal.aborted) return failed();
      if (!fetched.ok || fetched.value.code !== 0)
        return failed({
          message:
            "Alliance agent couldn't download the latest main. Check your internet connection, then try again.",
          details: fetched.ok
            ? failureOutput("git fetch", fetched.value).message
            : fetched.error.message,
        });
      const blocker = await updateBlocker(git.value, folder);
      if (!blocker.ok)
        return failed({
          message: `Alliance agent couldn't check ${folder}.`,
          details: blocker.error.message,
        });
      if (blocker.value)
        return this.set({
          status: RepositoryStatus.UpdateNeeded,
          folder,
          blocker: blocker.value,
        });
      // Neither timed out nor cancelled: git stopped partway leaves the files it wrote with main unmoved.
      const merged = await git.value.run({
        args: ["-C", folder, "merge", "--ff-only", "FETCH_HEAD"],
      });
      if (!merged.ok || merged.value.code !== 0)
        return failed({
          message:
            "Alliance agent couldn't fast-forward main. Fix what git reports in the details, then try again.",
          details: merged.ok
            ? failureOutput("git merge", merged.value).message
            : merged.error.message,
        });
      const found = await identify({
        git: git.value,
        source: this.params.source,
        folder,
      });
      if (!found.ok) return failed(found.error);
      this.set(identifiedState(found.value));
    })().finally(() => (this.running = undefined));
    this.running = { controller, done };
    return R.success(done);
  }

  private async startClone(git: Git, folder: string): Promise<void> {
    await this.stopRunning();
    if (this.closed) return;
    const controller = new AbortController();
    this.set({
      status: RepositoryStatus.Cloning,
      folder,
      phase: ClonePhase.Preparing,
    });
    const done = (async () => {
      const cloned = await cloneInto({
        git,
        url: this.params.source.url,
        folder,
        signal: controller.signal,
        onProgress: (progress) => {
          const shown = this.state;
          if (
            controller.signal.aborted ||
            shown.status !== RepositoryStatus.Cloning ||
            (shown.phase === progress.phase &&
              shown.percent === progress.percent)
          )
            return;
          this.set({ ...shown, ...progress });
        },
      });
      if (!cloned.ok) {
        if (!controller.signal.aborted)
          this.set({
            status: RepositoryStatus.NotSetUp,
            cloneFolder: folder,
            problem: cloned.error,
          });
        return;
      }
      const saved = await this.params.saved.write({
        kind: SavedKind.Copy,
        folder,
      });
      if (!saved.ok)
        console.error(
          `Couldn't save the cloned repository's folder: ${saved.error.message}`,
        );
      const found = await identify({ git, source: this.params.source, folder });
      this.set(
        found.ok
          ? identifiedState(found.value)
          : {
              status: RepositoryStatus.NotSetUp,
              cloneFolder: folder,
              problem: found.error,
            },
      );
    })().finally(() => {
      if (this.running?.controller === controller) this.running = undefined;
    });
    this.running = { controller, done };
  }

  private async save(choice: SavedChoice): Promise<Result<void, Problem>> {
    const saved = await this.params.saved.write(choice);
    return saved.ok
      ? saved
      : R.failure({
          message: "Alliance agent couldn't save your choice.",
          details: saved.error.message,
        });
  }

  /** Runs operation once every earlier one has finished, so their awaits never interleave. */
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async stopRunning(): Promise<void> {
    const running = this.running;
    if (!running) return;
    running.controller.abort();
    await running.done;
  }

  private async findGit(): Promise<Result<Git, string>> {
    if (this.git) return R.success(this.git);
    const found = await this.params.findGit();
    if (found.ok) this.git = found.value;
    return found;
  }

  private set(state: RepositoryState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}

const identifiedState = (found: Identified): RepositoryState =>
  found.outdated
    ? {
        status: RepositoryStatus.UpdateNeeded,
        folder: found.folder,
        blocker: found.outdated.blocker,
      }
    : { status: RepositoryStatus.Ready, folder: found.folder };

/** The copy whose top folder is folder; a folder inside some other checkout identifies as that checkout. */
async function copyAt(
  params: Parameters<typeof identify>[0],
): Promise<Identified | undefined> {
  const found = await identify(params);
  const real = await R.fromPromise(realpath(params.folder));
  return found.ok && real.ok && found.value.topLevel === real.value
    ? found.value
    : undefined;
}

async function nearestExisting(folder: string): Promise<string> {
  const parent = path.dirname(folder);
  if (parent === folder || (await R.fromPromise(access(folder))).ok)
    return folder;
  return nearestExisting(parent);
}
