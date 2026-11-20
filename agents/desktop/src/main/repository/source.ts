import path from "node:path";
import { z } from "zod";

export type RepositorySource = {
  url: string;
  /** The repository's root commit, which every full copy has, whatever its remotes are called. */
  firstCommit: string;
  /** A copy whose HEAD lacks this commit runs worktree scripts older than the app needs. */
  minimumCommit: string;
  defaultFolder: string;
};

export const allianceSource = (home: string): RepositorySource => ({
  url: "https://github.com/worldalliance/alliance.git",
  firstCommit: "08337694b991b30e3290e685ba656656c4ef5633",
  // Adds scripts/list-worktrees.ts, which the task sidebar reads.
  minimumCommit: "99c38cf0e4f7fb393bf874104f0074a35827db20",
  defaultFolder: path.join(home, "alliance", "workspaces", "alliance"),
});

/** Set by the e2e tests to a JSON RepositorySource, so no test clones from GitHub or finds the checkout the app runs from. An unpackaged app only. */
export const testSourceVariable = "ALLIANCE_AGENT_REPOSITORY_SOURCE";

export const testSource = z.strictObject({
  url: z.string().min(1),
  firstCommit: z.string().min(1),
  minimumCommit: z.string().min(1),
  defaultFolder: z.string().refine(path.isAbsolute, "not an absolute path"),
}) satisfies z.ZodType<RepositorySource>;
