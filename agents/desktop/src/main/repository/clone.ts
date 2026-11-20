import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import { R, type Result } from "../../../../../common/src/result";
import { ClonePhase, type Problem } from "../../shared/repository";
import { failureOutput } from "../agent/cli-process";
import { isNotFound } from "../fs-error";
import type { Git } from "./git";

export type CloneProgress = { phase: ClonePhase; percent?: number };

/** git sets no transfer timeout; this fails a stalled HTTPS download after a minute, while an SSH one waits for Cancel. */
export const stallLimit = [
  "-c",
  "http.lowSpeedLimit=1000",
  "-c",
  "http.lowSpeedTime=60",
];

const phases: Record<string, ClonePhase> = {
  "Counting objects": ClonePhase.Preparing,
  "Compressing objects": ClonePhase.Preparing,
  "Receiving objects": ClonePhase.Downloading,
  "Resolving deltas": ClonePhase.Unpacking,
  "Updating files": ClonePhase.WritingFiles,
};

const progressLine = new RegExp(
  `(${Object.keys(phases).join("|")}):\\s+(\\d+)%`,
  "g",
);

/** The latest phase and percentage in git clone --progress output. */
export function lastProgress(output: string): CloneProgress | undefined {
  const last = [...output.matchAll(progressLine)].at(-1);
  if (!last?.[1] || !last[2]) return undefined;
  const phase = phases[last[1]];
  return phase && { phase, percent: Number(last[2]) };
}

/** Whether folder can be cloned into: missing, or an empty folder. */
export async function isFreeFolder(
  folder: string,
): Promise<Result<boolean, Error>> {
  const entries = await R.fromPromise(readdir(folder));
  if (entries.ok) return R.success(entries.value.length === 0);
  return isNotFound(entries.error) ? R.success(true) : entries;
}

// Dotted, so a half-finished clone never looks like a copy or matches a worktree's alliance-<name> folder.
const partialPrefix = (folder: string) => `.${path.basename(folder)}.cloning-`;

/** Clones url into folder, which must be missing or empty, through a sibling folder renamed into place only once git succeeds, so a clone that fails or is cancelled leaves nothing that looks like a copy. */
export async function cloneInto(params: {
  git: Git;
  url: string;
  folder: string;
  signal: AbortSignal;
  onProgress: (progress: CloneProgress) => void;
}): Promise<Result<void, Problem>> {
  const { git, url, folder, signal } = params;
  const parent = path.dirname(folder);
  const fail = (message: string, details?: string) =>
    R.failure({ message, details });

  const made = await R.fromPromise(mkdir(parent, { recursive: true }));
  if (!made.ok)
    return fail(
      `Alliance agent couldn't create ${parent}.`,
      made.error.message,
    );
  const free = await isFreeFolder(folder);
  if (!free.ok)
    return fail(`Alliance agent can't open ${folder}.`, free.error.message);
  if (!free.value)
    return fail(
      `${folder} already has files in it. Choose an empty folder to clone into.`,
    );

  // A crash or forced quit mid-clone leaves its partial folder behind.
  const siblings = await R.fromPromise(readdir(parent));
  if (siblings.ok)
    await Promise.allSettled(
      siblings.value
        .filter((name) => name.startsWith(partialPrefix(folder)))
        .map((name) => remove(path.join(parent, name))),
    );

  const partial = path.join(parent, `${partialPrefix(folder)}${randomUUID()}`);
  let tail = "";
  const cloned = await git.run({
    args: [...stallLimit, "clone", "--progress", url, partial],
    signal,
    onStderr: (chunk) => {
      tail = (tail + chunk).slice(-500);
      const progress = lastProgress(tail);
      if (progress) params.onProgress(progress);
    },
  });
  const cleanUp = () => remove(partial);
  if (!cloned.ok) {
    await cleanUp();
    return fail(
      "Alliance agent couldn't clone the repository.",
      cloned.error.message,
    );
  }
  if (cloned.value.code !== 0) {
    await cleanUp();
    return fail(
      "Alliance agent couldn't clone the repository. Check your internet connection, then try again.",
      failureOutput("git clone", cloned.value).message,
    );
  }

  const emptied = await R.fromPromise(rmdir(folder));
  if (!emptied.ok && !isNotFound(emptied.error)) {
    await cleanUp();
    return fail(
      `Alliance agent couldn't replace ${folder}.`,
      emptied.error.message,
    );
  }
  const moved = await R.fromPromise(rename(partial, folder));
  if (!moved.ok) {
    await cleanUp();
    return fail(
      `Alliance agent couldn't move the clone into ${folder}.`,
      moved.error.message,
    );
  }
  return R.success(undefined);
}

// git's helpers can still be writing as a cancelled clone exits. A partial folder that won't go is left for the next clone's sweep.
const remove = (folder: string) =>
  R.fromPromise(rm(folder, { recursive: true, force: true, maxRetries: 5 }));
