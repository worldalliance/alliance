import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

export function git({
  repoRoot,
  args,
  input,
}: {
  repoRoot: string;
  args: string[];
  input?: string;
}): Buffer {
  const run = spawnSync("git", args, {
    cwd: repoRoot,
    input,
    maxBuffer: 1 << 30,
  });
  if (run.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${run.stderr}`);
  }
  return run.stdout;
}

export function mergeBaseFromArgs(): {
  base: string;
  repoRoot: string;
  baseCommit: string;
} {
  const { values } = parseArgs({
    options: { base: { type: "string", default: "origin/main" } },
  });
  const base = values.base;
  const root = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  if (root.status !== 0) {
    throw new Error(`not in a git checkout\n${root.stderr}`);
  }
  const repoRoot = root.stdout.trim();
  const mergeBase = spawnSync("git", ["merge-base", "HEAD", base], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (mergeBase.status !== 0) {
    throw new Error(`no merge-base with ${base}\n${mergeBase.stderr}`);
  }
  return { base, repoRoot, baseCommit: mergeBase.stdout.trim() };
}
