import type { Problem } from "./repository";

export enum WorktreeStatus {
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
  /** Looking for a worktree the script made, when an earlier attempt couldn't find it. */
  Finding = "finding",
}

export type WorktreeState =
  | { status: WorktreeStatus.Creating; stage: CreationStage }
  | {
      status: WorktreeStatus.CreateFailed;
      problem: Problem;
      /** What the failed creation left behind, in words, or undefined when it left nothing. */
      leftover?: string;
      /** Whether the script made the worktree, so only Try again, which finds it rather than making another, is offered. */
      made: boolean;
      /** The name as the user typed it. */
      typed: string;
    }
  | { status: WorktreeStatus.Ready; problem?: string }
  | { status: WorktreeStatus.NotFinished }
  | { status: WorktreeStatus.Removing }
  | { status: WorktreeStatus.Broken; problem: string };

export type Worktree = {
  /** Stable while the app runs: the worktree record's id, the folder of a worktree without one, or new:<id> while the app creates it. */
  key: string;
  /** The worktree's name, or while the app creates it, the name it chose or will start from. */
  name: string;
  /** Undefined until the worktree exists. */
  folder?: string;
  branch?: string;
  /** The key of the worktree this one was created from, such as by an agent working in it. */
  parent?: string;
  archived: boolean;
  state: WorktreeState;
};

export enum WorktreesStatus {
  /** No usable copy of the repository, so there are no worktrees to list. */
  NoRepository = "no-repository",
  Loading = "loading",
  Listed = "listed",
}

export type WorktreesState = {
  status: WorktreesStatus;
  worktrees: Worktree[];
  /** Why the last listing failed; worktrees then holds what the app last knew. */
  problem?: Problem;
  /** Maps the new:<id> key of each creation finished while the app runs to its worktree's key, for a window that missed the creation's reply, as after a reload. */
  created: Record<string, string>;
};

const newWorktreePrefix = "new:";

export const newWorktreeKey = (creationId: string) =>
  newWorktreePrefix + creationId;

export const isNewWorktreeKey = (key: string) =>
  key.startsWith(newWorktreePrefix);

// A worktree's test database is alliance_<name>_test, which Postgres cuts off past 63 bytes.
const maxNameLength = 40;

/** The worktree name typed text gives before numbering past taken names: its words in letters from a to z, accents dropped, and digits, joined by dashes as scripts/new-worktree.sh requires, cut at a whole word, or within a first word too long to fit, to leave room for a number. Letters such as ø, ß or Cyrillic ones are dropped, so it is empty when no letter from a to z or digit is left. */
export function nameBase(typed: string): string {
  const words = typed
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  let base = "";
  for (const word of words) {
    const next = base ? `${base}-${word}` : word;
    if (next.length > maxNameLength - 3) break;
    base = next;
  }
  return base || (words[0]?.slice(0, maxNameLength - 3) ?? "");
}
