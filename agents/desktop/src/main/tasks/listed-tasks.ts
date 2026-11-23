import path from "node:path";
import { type Task, TaskStatus } from "../../shared/task";
import type { SavedTask } from "./store";
import { type Worktree, WorktreeState } from "./worktrees";

/** The tasks the worktrees list, leaving out the main checkout and the worktrees of creations in progress, named in creating. */
export function listedTasks(params: {
  worktrees: Worktree[];
  saved: SavedTask[];
  creating: Set<string>;
}): Task[] {
  const saved = new Map(params.saved.map((task) => [task.worktree, task]));
  const parents = new Map(
    params.worktrees.flatMap(({ id, parent }) =>
      id && parent ? [[id, parent]] : [],
    ),
  );
  // A task nests under its parent, so one whose parents loop would show nowhere.
  const inLoop = (key: string) => {
    const seen = new Set<string>();
    for (let at = parents.get(key); at; at = parents.get(at)) {
      if (at === key || seen.has(at)) return true;
      seen.add(at);
    }
    return false;
  };
  return params.worktrees.flatMap((worktree): Task[] => {
    if (worktree.state === WorktreeState.Main) return [];
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
        state: looped
          ? {
              status: TaskStatus.Broken,
              problem:
                "The worktree records above it form a parent loop. Fix or remove those records.",
            }
          : listedState(worktree),
      },
    ];
  });
}

function listedState(worktree: Worktree): Task["state"] {
  if (worktree.prunable)
    return {
      status: TaskStatus.Broken,
      problem:
        "Its folder is gone. git worktree prune, run in Terminal from the repository, removes it from the list.",
    };
  switch (worktree.state) {
    case WorktreeState.Main:
    case WorktreeState.Recorded:
    case WorktreeState.Unrecorded:
      return {
        status: TaskStatus.Ready,
        problem: worktree.problem ?? undefined,
      };
    case WorktreeState.HalfCreated:
      return { status: TaskStatus.NotFinished };
    case WorktreeState.HalfRemoved:
      return { status: TaskStatus.Removing };
    case WorktreeState.Invalid:
      return {
        status: TaskStatus.Broken,
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
