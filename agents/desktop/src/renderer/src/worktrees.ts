import { useEffect, useState } from "react";
import type { Conversation } from "../../shared/conversation";
import type { IpcResult } from "../../shared/ipc";
import {
  CreationStage,
  type Worktree,
  type WorktreesState,
  WorktreeStatus,
} from "../../shared/worktree";
import { agent } from "./agent";

export type ShownWorktrees = {
  /** Undefined until the main process answers. */
  state?: WorktreesState;
  problem?: string;
};

export function useWorktrees(): ShownWorktrees {
  const [shown, setShown] = useState<ShownWorktrees>({});
  useEffect(() => {
    let changed = false;
    const unsubscribe = agent.onWorktreesChanged((state) => {
      changed = true;
      setShown({ state });
    });
    void agent.worktreesState().then((read) => {
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
  [CreationStage.Finding]: "Finding the new worktree…",
};

/** The worktree's state in a few words, for the sidebar. */
export function worktreeStateWords(worktree: Worktree): string {
  const { state } = worktree;
  switch (state.status) {
    case WorktreeStatus.Creating:
      return stageWords[state.stage];
    case WorktreeStatus.CreateFailed:
      return "Couldn't be created";
    case WorktreeStatus.Ready:
      return state.problem ? "Needs attention" : "Ready";
    case WorktreeStatus.NotFinished:
      return "Not finished being created";
    case WorktreeStatus.Removing:
      return "Not finished being removed";
    case WorktreeStatus.Broken:
      return "Needs attention";
    default:
      throw new Error(`unknown worktree status: ${state satisfies never}`);
  }
}

/** The conversations in each worktree's folder, and those in no worktree's folder, archived worktrees included. */
export function groupConversations(params: {
  conversations: Conversation[];
  worktrees: Worktree[];
}): { byFolder: Map<string, Conversation[]>; others: Conversation[] } {
  const folders = new Set(params.worktrees.flatMap((t) => t.folder ?? []));
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

/** A worktree the app is creating, or failed to create, which has nothing to archive yet. */
export const isCreation = (worktree: Worktree): boolean =>
  creation[worktree.state.status];

const creation: Record<WorktreeStatus, boolean> = {
  [WorktreeStatus.Creating]: true,
  [WorktreeStatus.CreateFailed]: true,
  [WorktreeStatus.Ready]: false,
  [WorktreeStatus.NotFinished]: false,
  [WorktreeStatus.Removing]: false,
  [WorktreeStatus.Broken]: false,
};

export type WorktreeAction = {
  /** What the action in progress does, in words that follow "couldn't". */
  pending?: string;
  problem?: string;
  act: (params: { run: () => Promise<IpcResult<void>>; words: string }) => void;
};

/** Each worktree's Archive or Restore in progress and its last problem, kept while the worktree isn't shown, since an archive can outlast the visit. */
export function useWorktreeActions(): (key: string) => WorktreeAction {
  const [actions, setActions] = useState<
    Record<string, Omit<WorktreeAction, "act">>
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
