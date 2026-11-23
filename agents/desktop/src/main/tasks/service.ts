import { R, type Result } from "../../../../../common/src/result";
import type { AgentKind } from "../../shared/agent-kind";
import type { Conversation } from "../../shared/conversation";
import type { CreatedTask, IpcResult, StartInput } from "../../shared/ipc";
import type { Problem } from "../../shared/repository";
import {
  CreationStage,
  newTaskKey,
  type Task,
  type TasksState,
  TasksStatus,
  TaskStatus,
} from "../../shared/task";
import { conversationTitle } from "../conversations";
import { fetchMain } from "../repository/fetch";
import type { Git } from "../repository/git";
import { localBranches, runNewWorktree, taskName } from "./create";
import { listedTasks } from "./listed-tasks";
import type { SavedTask, TaskStore } from "./store";
import { type Bun, listWorktrees, type Worktree } from "./worktrees";

type Creation = {
  key: string;
  title: string;
  request: string;
  agent: AgentKind;
  /** Set once chosen, so a listing shows the worktree as this creation rather than as a task of its own. */
  name?: string;
  /** Names earlier attempts used. The script can refuse a name before leaving anything that marks it taken, such as when its folder exists. */
  tried: string[];
  /** Set once scripts/new-worktree.sh has created the worktree, so Try again looks for it rather than creating another. */
  made?: boolean;
  task: Task;
  controller: AbortController;
};

/** Lists the repository's worktrees as tasks, and creates them. Each task's conversations are the ones whose folder is its worktree. */
export class TaskService {
  private state: TasksState = {
    status: TasksStatus.NoRepository,
    tasks: [],
    created: {},
  };
  private readonly listeners = new Set<(state: TasksState) => void>();
  private worktrees: Worktree[] = [];
  private saved: SavedTask[] = [];
  private readonly creations = new Map<string, Creation>();
  private running = new Set<Promise<unknown>>();
  private listing: Promise<void> | undefined;
  private listAgain = false;
  private closed = false;

  constructor(
    private readonly params: {
      /** The main checkout, while there is a usable one. */
      checkout: () => string | undefined;
      repositoryUrl: string;
      findGit: () => Promise<Result<Git, string>>;
      findBun: () => Result<Bun, Error>;
      store: TaskStore;
      /** Starts a conversation in folder and sends it firstMessage. */
      startConversation: (
        input: StartInput,
      ) => Promise<IpcResult<Conversation>>;
    },
  ) {}

  current(): TasksState {
    return this.state;
  }

  subscribe(listener: (state: TasksState) => void): () => void {
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
      this.worktrees = [];
      return this.publish({
        status: TasksStatus.NoRepository,
        problem: undefined,
      });
    }
    if (this.state.status === TasksStatus.NoRepository)
      this.publish({ status: TasksStatus.Loading });
    const [listed, saved] = await Promise.all([
      this.list(checkout),
      this.params.store.list(),
    ]);
    if (saved.ok) this.saved = saved.value;
    if (listed.ok) this.worktrees = listed.value;
    const problem = !listed.ok
      ? {
          message: "Alliance agent couldn't list your tasks.",
          details: listed.error.message,
        }
      : !saved.ok
        ? {
            message: "Alliance agent couldn't read which tasks it created.",
            details: saved.error.message,
          }
        : undefined;
    this.publish({
      status:
        listed.ok || this.state.status === TasksStatus.Listed
          ? TasksStatus.Listed
          : TasksStatus.Loading,
      problem,
    });
  }

  private list(checkout: string): Promise<Result<Worktree[], Error>> {
    const bun = this.params.findBun();
    return bun.ok
      ? listWorktrees({ bun: bun.value, checkout })
      : Promise.resolve(bun);
  }

  /** Creates a worktree for request, then starts its first conversation there with request as the first message. Fails when the worktree couldn't be created, leaving the task in the list with what went wrong until it is retried or dismissed. */
  create(input: {
    creationId: string;
    request: string;
    agent: AgentKind;
  }): Promise<Result<CreatedTask, Problem>> {
    const key = newTaskKey(input.creationId);
    if (this.creations.has(key))
      return Promise.resolve(
        R.failure({ message: "This task is already being created." }),
      );
    const title = conversationTitle(input.request);
    return this.run({
      key,
      title,
      request: input.request,
      agent: input.agent,
      tried: [],
      controller: new AbortController(),
      task: creatingTask({ key, title, stage: CreationStage.Downloading }),
    });
  }

  /** Creates a failed task's worktree again, under a new name. */
  retry(key: string): Promise<Result<CreatedTask, Problem>> {
    const failed = this.creations.get(key);
    if (failed?.task.state.status !== TaskStatus.CreateFailed)
      return Promise.resolve(
        R.failure({ message: "This task isn't waiting to be tried again." }),
      );
    return this.run({
      ...failed,
      ...(!failed.made && {
        name: undefined,
        tried: failed.name ? [...failed.tried, failed.name] : failed.tried,
      }),
      controller: new AbortController(),
      task: creatingTask({
        ...failed,
        stage: failed.made
          ? CreationStage.StartingAgent
          : CreationStage.Downloading,
      }),
    });
  }

  /** Forgets a failed creation that made no worktree; what it left behind stays listed. */
  dismiss(key: string): void {
    const failed = this.creations.get(key);
    if (failed?.task.state.status !== TaskStatus.CreateFailed || failed.made)
      return;
    this.creations.delete(key);
    this.publish({});
  }

  private run(creation: Creation): Promise<Result<CreatedTask, Problem>> {
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
          status: TaskStatus.CreateFailed,
          problem: result.error.problem,
          leftover: result.error.leftover,
          made: !!creation.made,
          request: creation.request,
          agent: creation.agent,
        });
      return R.mapError(result, ({ problem }) => problem);
    });
    this.running.add(done);
    void done.finally(() => this.running.delete(done));
    return done;
  }

  private setCreation(creation: Creation, state: Task["state"]): void {
    creation.task = { ...creation.task, state };
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
          message: "Alliance agent couldn't check which task names are taken.",
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
    const name = taskName(creation.request, taken);
    creation.name = name;
    this.setCreation(creation, {
      status: TaskStatus.Creating,
      stage: CreationStage.CopyingDatabase,
    });
    const made = await runNewWorktree({
      checkout,
      name,
      from: from.value,
      signal,
      onStage: (stage) =>
        this.setCreation(creation, { status: TaskStatus.Creating, stage }),
    });
    if (made.ok) return R.success(undefined);
    const relisted = await this.list(checkout);
    const worktree = relisted.ok
      ? relisted.value.find((w) => w.name === name)
      : undefined;
    const key = worktree && (worktree.id ?? worktree.path);
    // The leftover is the app's, so it lists under the request's title once this creation goes.
    const saved = key
      ? await this.params.store.update(key, (task) => ({
          ...task,
          title: creation.title,
        }))
      : R.success(undefined);
    if (relisted.ok) await this.refresh();
    return R.failure({
      problem: saved.ok
        ? made.error
        : {
            ...made.error,
            details: [
              made.error.details,
              `Alliance agent couldn't save what was created as a task it created: ${saved.error.message}`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
      leftover: !relisted.ok
        ? `Alliance agent couldn't check whether part of it was created: ${relisted.error.message}. scripts/list-worktrees.ts, run in Terminal from ${checkout}, shows it.`
        : worktree
          ? `Part of it was created: ${worktree.path ?? `a record named ${name}`}. Alliance agent can't remove that yet; scripts/rm-worktree.sh ${name}, run in Terminal from ${checkout}, does.`
          : undefined,
    });
  }

  private async createNow(
    creation: Creation,
  ): Promise<Result<CreatedTask, { problem: Problem; leftover?: string }>> {
    const checkout = this.params.checkout();
    if (!checkout)
      return R.failure({
        problem: {
          message:
            "Alliance agent needs the Alliance repository to be ready to create a task. Try again once it is.",
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
    const saved = await this.params.store.update(worktree.id, (task) => ({
      ...task,
      title: creation.title,
    }));
    if (!saved.ok)
      return R.failure({
        problem: {
          message: `Alliance agent created ${name}, but couldn't save it as a task it created.`,
          details: saved.error.message,
        },
        leftover,
      });
    await this.refresh();
    this.setCreation(creation, {
      status: TaskStatus.Creating,
      stage: CreationStage.StartingAgent,
    });
    const conversation = await this.params.startConversation({
      folder: worktree.path,
      firstMessage: creation.request,
      agent: creation.agent,
    });
    return R.success({
      key: worktree.id,
      folder: worktree.path,
      conversation,
    });
  }

  /** Aborts creations in progress and waits for their scripts to exit; a step a script was running can outlive it (ALL-2391). */
  async close(): Promise<void> {
    this.closed = true;
    for (const creation of this.creations.values()) creation.controller.abort();
    await Promise.allSettled(this.running);
    await this.listing;
  }

  private publish(change: Partial<TasksState>): void {
    const next = { ...this.state, ...change };
    this.state = {
      ...next,
      tasks: [
        ...[...this.creations.values()].map(({ task }) => task),
        ...listedTasks({
          worktrees: this.worktrees,
          saved: this.saved,
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

const creatingTask = (params: {
  key: string;
  title: string;
  stage: CreationStage;
}): Task => ({
  key: params.key,
  title: params.title,
  createdByApp: true,
  state: { status: TaskStatus.Creating, stage: params.stage },
});
