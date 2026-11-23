import { useEffect, useState } from "react";
import type { Conversation } from "../../shared/conversation";
import type { IpcResult } from "../../shared/ipc";
import {
  CreationStage,
  type Task,
  type TasksState,
  TaskStatus,
} from "../../shared/task";
import { agent } from "./agent";

export type ShownTasks = {
  /** Undefined until the main process answers. */
  state?: TasksState;
  problem?: string;
};

export function useTasks(): ShownTasks {
  const [shown, setShown] = useState<ShownTasks>({});
  useEffect(() => {
    let changed = false;
    const unsubscribe = agent.onTasksChanged((state) => {
      changed = true;
      setShown({ state });
    });
    void agent.tasksState().then((read) => {
      if (changed) return;
      setShown(read.ok ? { state: read.value } : { problem: read.error });
    });
    return unsubscribe;
  }, []);
  return shown;
}

const stageWords: Record<CreationStage, string> = {
  [CreationStage.Downloading]: "Downloading the latest main…",
  [CreationStage.CopyingDatabase]: "Copying the database…",
  [CreationStage.CreatingFolder]: "Creating its folder…",
  [CreationStage.CopyingSettings]: "Copying settings…",
  [CreationStage.InstallingDependencies]: "Installing dependencies…",
  [CreationStage.StartingAgent]: "Starting the agent…",
};

/** The task's state in a few words, for the sidebar. */
export function taskStateWords(task: Task): string {
  const { state } = task;
  switch (state.status) {
    case TaskStatus.Creating:
      return stageWords[state.stage];
    case TaskStatus.CreateFailed:
      return "Couldn't be created";
    case TaskStatus.Ready:
      return state.problem ? "Needs attention" : "Ready";
    case TaskStatus.NotFinished:
      return "Not finished being created";
    case TaskStatus.Removing:
      return "Not finished being removed";
    case TaskStatus.Broken:
      return "Needs attention";
    default:
      throw new Error(`unknown task status: ${state satisfies never}`);
  }
}

export const outsideWords = "Made outside Alliance agent";

/** The conversations in each task's folder, and those in no task's folder, archived tasks included. */
export function groupConversations(params: {
  conversations: Conversation[];
  tasks: Task[];
}): { byFolder: Map<string, Conversation[]>; others: Conversation[] } {
  const folders = new Set(params.tasks.flatMap((t) => t.folder ?? []));
  const byFolder = new Map<string, Conversation[]>();
  const others: Conversation[] = [];
  for (const conversation of params.conversations) {
    if (!folders.has(conversation.folder)) {
      others.push(conversation);
      continue;
    }
    byFolder.set(conversation.folder, [
      ...(byFolder.get(conversation.folder) ?? []),
      conversation,
    ]);
  }
  return { byFolder, others };
}

/** A task the app is creating, or failed to create, which has no worktree to archive yet. */
export const isCreation = (task: Task): boolean => creation[task.state.status];

const creation: Record<TaskStatus, boolean> = {
  [TaskStatus.Creating]: true,
  [TaskStatus.CreateFailed]: true,
  [TaskStatus.Ready]: false,
  [TaskStatus.NotFinished]: false,
  [TaskStatus.Removing]: false,
  [TaskStatus.Broken]: false,
};

export type TaskAction = {
  /** What the action in progress does, in words that follow "couldn't". */
  pending?: string;
  problem?: string;
  act: (params: { run: () => Promise<IpcResult<void>>; words: string }) => void;
};

/** Each task's Archive or Restore in progress and its last problem, kept while the task isn't shown, since an archive can outlast the visit. */
export function useTaskActions(): (key: string) => TaskAction {
  const [actions, setActions] = useState<
    Record<string, Omit<TaskAction, "act">>
  >({});
  return (key) => ({
    ...actions[key],
    act: ({ run, words }) => {
      if (actions[key]?.pending) return;
      setActions((all) => ({ ...all, [key]: { pending: words } }));
      void run().then((done) =>
        setActions((all) => ({
          ...all,
          [key]: done.ok
            ? {}
            : { problem: `Alliance agent couldn't ${words}: ${done.error}` },
        })),
      );
    },
  });
}
