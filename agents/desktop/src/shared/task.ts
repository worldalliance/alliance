import type { AgentKind } from "./agent-kind";
import type { Problem } from "./repository";

export enum TaskStatus {
  Creating = "creating",
  CreateFailed = "create-failed",
  Ready = "ready",
  /** A creation the app isn't running, such as one a terminal started or one that stopped partway. */
  NotFinished = "not-finished",
  /** A removal that hasn't finished, or stopped partway. */
  Removing = "removing",
  /** The worktree scripts' records contradict each other or git. */
  Broken = "broken",
}

export enum CreationStage {
  Downloading = "downloading",
  CopyingDatabase = "copying-database",
  CreatingFolder = "creating-folder",
  CopyingSettings = "copying-settings",
  InstallingDependencies = "installing-dependencies",
  StartingAgent = "starting-agent",
}

export type TaskState =
  | { status: TaskStatus.Creating; stage: CreationStage }
  | {
      status: TaskStatus.CreateFailed;
      problem: Problem;
      /** What the failed creation left behind, in words, or undefined when it left nothing. */
      leftover?: string;
      /** Whether the script made the worktree, which only Try again saves as the app's, so the creation can't be dismissed. */
      made: boolean;
      request: string;
      agent: AgentKind;
    }
  | { status: TaskStatus.Ready; problem?: string }
  | { status: TaskStatus.NotFinished }
  | { status: TaskStatus.Removing }
  | { status: TaskStatus.Broken; problem: string };

export type Task = {
  /** Stable while the app runs: the worktree record's id, the folder of a worktree without one, or new:<id> while the app creates it. */
  key: string;
  title: string;
  /** Undefined until the worktree exists. */
  folder?: string;
  branch?: string;
  /** The key of the task whose worktree this one was created from, such as by an agent working in it. */
  parent?: string;
  /** False for a worktree made with a terminal or by an agent. */
  createdByApp: boolean;
  state: TaskState;
};

export enum TasksStatus {
  /** No usable copy of the repository, so there are no tasks to list. */
  NoRepository = "no-repository",
  Loading = "loading",
  Listed = "listed",
}

export type TasksState = {
  status: TasksStatus;
  tasks: Task[];
  /** Why the last listing failed; tasks then holds what the app last knew. */
  problem?: Problem;
  /** Maps the new:<id> key of each creation finished while the app runs to its task's key, for a window that missed the creation's reply, as after a reload. */
  created: Record<string, string>;
};

const newTaskPrefix = "new:";

export const newTaskKey = (creationId: string) => newTaskPrefix + creationId;

export const isNewTaskKey = (key: string) => key.startsWith(newTaskPrefix);
