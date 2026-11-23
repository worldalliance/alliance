import path from "node:path";
import { type Worktree, WorktreeStatus } from "../../shared/worktree";
import { type ListedWorktree, ListedWorktreeState } from "./list";
import type { SavedWorktree } from "./store";

/** The worktrees the script lists, leaving out the main checkout and the worktrees of creations in progress, named in creating. A worktree still archiving shows unarchived until its agents stop. */
export function listedWorktrees(params: {
  listed: ListedWorktree[];
  saved: SavedWorktree[];
  archiving: Set<string>;
  creating: Set<string>;
}): Worktree[] {
  const saved = new Map(params.saved.map((own) => [own.key, own]));
  const parents = new Map(
    params.listed.flatMap(({ id, parent }) =>
      id && parent ? [[id, parent]] : [],
    ),
  );
  // A worktree nests under its parent, so one whose parents loop would show nowhere.
  const inLoop = (key: string) => {
    const seen = new Set<string>();
    for (let at = parents.get(key); at; at = parents.get(at)) {
      if (at === key || seen.has(at)) return true;
      seen.add(at);
    }
    return false;
  };
  return params.listed.flatMap((worktree): Worktree[] => {
    if (worktree.state === ListedWorktreeState.Main) return [];
    if (worktree.name && params.creating.has(worktree.name)) return [];
    const key = worktree.id ?? worktree.path;
    if (!key) return [];
    const own = saved.get(key);
    const looped = inLoop(key);
    const parent =
      worktree.parent && worktree.parent !== "main" && !looped
        ? worktree.parent
        : undefined;
    return [
      {
        key,
        title:
          own?.title ??
          worktree.name ??
          (worktree.path ? path.basename(worktree.path) : key),
        folder: worktree.path ?? undefined,
        branch: worktree.branch ?? undefined,
        parent,
        createdByApp: own?.title !== undefined,
        archived: !!own?.archived && !params.archiving.has(key),
        state: looped
          ? {
              status: WorktreeStatus.Broken,
              problem:
                "The worktree records above it form a parent loop. Fix or remove those records.",
            }
          : listedState(worktree),
      },
    ];
  });
}

function listedState(worktree: ListedWorktree): Worktree["state"] {
  if (worktree.prunable)
    return {
      status: WorktreeStatus.Broken,
      problem:
        "Its folder is gone. git worktree prune, run in Terminal from the repository, removes it from the list.",
    };
  switch (worktree.state) {
    case ListedWorktreeState.Main:
    case ListedWorktreeState.Recorded:
    case ListedWorktreeState.Unrecorded:
      return {
        status: WorktreeStatus.Ready,
        problem: worktree.problem ?? undefined,
      };
    case ListedWorktreeState.HalfCreated:
      return { status: WorktreeStatus.NotFinished };
    case ListedWorktreeState.HalfRemoved:
      return { status: WorktreeStatus.Removing };
    case ListedWorktreeState.Invalid:
      return {
        status: WorktreeStatus.Broken,
        problem: worktree.problem
          ? `Its records don't add up: ${worktree.problem}.`
          : "Its records don't add up.",
      };
    default:
      throw new Error(
        `unknown worktree state: ${worktree.state satisfies never}`,
      );
  }
}
