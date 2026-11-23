import { z } from "zod";
import { R, type Result } from "../../../../../common/src/result";
import { failureOutput, queryTimeoutMs, runCli } from "../agent/cli-process";
import { describeError } from "../describe-error";

export enum WorktreeState {
  Main = "main",
  Recorded = "recorded",
  Unrecorded = "unrecorded",
  HalfCreated = "half-created",
  HalfRemoved = "half-removed",
  Invalid = "invalid",
}

// The fields of scripts/list-worktrees.ts's version 1 the app reads; a new field leaves the version alone, so unknown keys pass.
const worktreeSchema = z.object({
  path: z.string().nullable(),
  state: z.enum(WorktreeState),
  problem: z.string().nullable(),
  id: z.string().nullable(),
  name: z.string().nullable(),
  branch: z.string().nullable(),
  parent: z.string().nullable(),
  prunable: z.boolean(),
});

export type Worktree = z.infer<typeof worktreeSchema>;

export const listVersion = 1;

const listSchema = z.object({
  version: z.literal(listVersion),
  worktrees: z.array(worktreeSchema),
});

export type Bun = { executable: string; env: NodeJS.ProcessEnv };

/** Runs the copy's own scripts/list-worktrees.ts, since the app and the copy it drives update separately. */
export async function listWorktrees(params: {
  bun: Bun;
  checkout: string;
}): Promise<Result<Worktree[], Error>> {
  const { bun, checkout } = params;
  const exited = await runCli(
    { ...bun, name: "bun" },
    {
      args: ["scripts/list-worktrees.ts"],
      cwd: checkout,
      signal: AbortSignal.timeout(queryTimeoutMs),
    },
  );
  if (!exited.ok) return exited;
  if (exited.value.code !== 0)
    return R.failure(
      failureOutput("bun scripts/list-worktrees.ts", exited.value),
    );
  return parseWorktreeList(exited.value.stdout);
}

export function parseWorktreeList(stdout: string): Result<Worktree[], Error> {
  const json: Result<unknown, Error> = R.fromThrowable(() =>
    JSON.parse(stdout),
  );
  if (!json.ok)
    return R.failure(
      new Error("scripts/list-worktrees.ts printed something other than JSON"),
    );
  const version = z.object({ version: z.unknown() }).safeParse(json.value);
  if (version.success && version.data.version !== listVersion)
    return R.failure(
      new Error(
        `scripts/list-worktrees.ts printed version ${String(version.data.version)} of its list, and this Alliance agent reads version ${listVersion}. Update Alliance agent or the repository.`,
      ),
    );
  return R.fromThrowable(
    () => listSchema.parse(json.value).worktrees,
    (error) =>
      new Error(
        `scripts/list-worktrees.ts printed a list this Alliance agent can't read: ${describeError(error)}`,
      ),
  );
}
