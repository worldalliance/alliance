import { R, type Result } from "../../../../../common/src/result";
import type { Problem } from "../../shared/repository";
import { CreationStage } from "../../shared/worktree";
import { failureOutput, runCli } from "../agent/cli-process";
import { gitEnvironment } from "../git-environment";
import type { Git } from "../repository/git";

/** base, numbered (-2, -3) past every name in taken. */
export function worktreeName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix++)
    if (!taken.has(`${base}-${suffix}`)) return `${base}-${suffix}`;
}

/** Local branch names and each of their slash prefixes, which a new worktree's branch mustn't reuse: scripts/new-worktree.sh checks out an existing branch rather than starting from main, and git can't create `fix` beside `fix/login`. */
export async function localBranches(
  git: Git,
  checkout: string,
): Promise<Result<string[], Error>> {
  const listed = await git.output([
    "-C",
    checkout,
    "for-each-ref",
    "--format=%(refname:lstrip=2)",
    "refs/heads",
  ]);
  return R.map(listed, (out) =>
    out
      .split("\n")
      .filter(Boolean)
      .flatMap((branch) =>
        branch.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/")),
      ),
  );
}

const stagePrefixes: [string, CreationStage][] = [
  ["==> copying database", CreationStage.CopyingDatabase],
  ["==> creating test database", CreationStage.CopyingDatabase],
  ["==> creating worktree", CreationStage.CreatingFolder],
  ["==> copying local", CreationStage.CopyingSettings],
  ["==> writing .worktree", CreationStage.CopyingSettings],
  ["==> applying", CreationStage.CopyingSettings],
  ["==> bun install", CreationStage.InstallingDependencies],
];

/** The stage a line of scripts/new-worktree.sh's output starts, if it starts one. */
export const stageOf = (line: string): CreationStage | undefined =>
  stagePrefixes.find(([prefix]) => line.startsWith(prefix))?.[1];

/** Runs the copy's scripts/new-worktree.sh from its main checkout, so the worktree is a sibling of it, reporting each stage the script starts. */
export async function runNewWorktree(params: {
  checkout: string;
  name: string;
  from: string;
  signal: AbortSignal;
  onStage: (stage: CreationStage) => void;
}): Promise<Result<void, Problem>> {
  let partial = "";
  const exited = await runCli(
    { executable: "/bin/bash", env: gitEnvironment(), name: "bash" },
    {
      args: ["scripts/new-worktree.sh", params.name, "--from", params.from],
      cwd: params.checkout,
      signal: params.signal,
      onStdout: (chunk) => {
        const lines = (partial + chunk).split("\n");
        partial = lines.pop() ?? "";
        for (const line of lines) {
          const stage = stageOf(line);
          if (stage) params.onStage(stage);
        }
      },
    },
  );
  if (exited.ok && exited.value.code === 0) return R.success(undefined);
  return R.failure({
    message: "Alliance agent couldn't create the worktree.",
    details: exited.ok
      ? failureOutput("scripts/new-worktree.sh", exited.value).message
      : exited.error.message,
  });
}
