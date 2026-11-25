import { realpath } from "node:fs/promises";
import path from "node:path";
import { R, type Result } from "../../../../../common/src/result";
import {
  type Problem,
  type UpdateBlocker,
  UpdateBlockerKind,
} from "../../shared/repository";
import { isNotFound } from "../fs-error";
import type { Git } from "./git";
import type { RepositorySource } from "./source";

export enum FolderProblemKind {
  Missing = "missing",
  NotRepository = "not-repository",
  OtherRepository = "other-repository",
  Incomplete = "incomplete",
  Failed = "failed",
}

export type FolderProblem = Problem & { kind: FolderProblemKind };

export type Identified = {
  /** The main checkout, which the worktree scripts run from. */
  folder: string;
  /** The top folder of the checkout given, which differs from folder for a worktree. */
  topLevel: string;
  /** Present when the copy is too old: undefined blocker means it can be fast-forwarded. */
  outdated?: { blocker?: UpdateBlocker };
};

const problem = (found: FolderProblem): Result<never, FolderProblem> =>
  R.failure(found);

/** Whether folder is in a full copy of the repository source names, resolved to its main checkout. */
export async function identify(params: {
  git: Git;
  source: RepositorySource;
  folder: string;
}): Promise<Result<Identified, FolderProblem>> {
  const { git, source } = params;
  const real = await R.fromPromise(realpath(params.folder));
  if (!real.ok)
    return isNotFound(real.error)
      ? problem({
          kind: FolderProblemKind.Missing,
          message: `${params.folder} doesn't exist.`,
        })
      : problem({
          kind: FolderProblemKind.Failed,
          message: `Alliance agent can't open ${params.folder}.`,
          details: real.error.message,
        });
  const folder = real.value;
  const couldNotCheck = (error: Error) =>
    problem({
      kind: FolderProblemKind.Failed,
      message: `Alliance agent couldn't check ${folder}.`,
      details: error.message,
    });

  const layout = await git.query([
    "-C",
    folder,
    "rev-parse",
    "--is-bare-repository",
    "--is-shallow-repository",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  if (!layout.ok) return couldNotCheck(layout.error);
  if (layout.value.code !== 0)
    return /not a git repository/i.test(layout.value.stderr)
      ? problem({
          kind: FolderProblemKind.NotRepository,
          message: `${folder} isn't a copy of the Alliance repository.`,
        })
      : couldNotCheck(new Error(layout.value.stderr.trim()));
  const [bare, shallow, commonDir] = layout.value.stdout.trim().split("\n");
  if (bare === "true" || !commonDir || path.basename(commonDir) !== ".git")
    return problem({
      kind: FolderProblemKind.NotRepository,
      message: `${folder} isn't a copy of the Alliance repository that Alliance agent can work in.`,
    });
  const main = path.dirname(commonDir);

  const topLevel = await git.output([
    "-C",
    folder,
    "rev-parse",
    "--show-toplevel",
  ]);
  if (!topLevel.ok) return couldNotCheck(topLevel.error);

  const first = await git.query([
    "-C",
    main,
    "cat-file",
    "-e",
    `${source.firstCommit}^{commit}`,
  ]);
  if (!first.ok) return couldNotCheck(first.error);
  if (first.value.code !== 0)
    return shallow === "true"
      ? problem({
          kind: FolderProblemKind.Incomplete,
          message: `${folder} is a partial (shallow) copy, which lacks the history agents read. Clone the Alliance repository in full instead.`,
        })
      : problem({
          kind: FolderProblemKind.OtherRepository,
          message: `${folder} is a copy of another repository, not the Alliance repository.`,
        });

  const identified = { folder: main, topLevel: topLevel.value.trim() };
  // Exit 1 means HEAD lacks the commit; 128 means the copy has never fetched it.
  const current = await git.query([
    "-C",
    main,
    "merge-base",
    "--is-ancestor",
    source.minimumCommit,
    "HEAD",
  ]);
  if (!current.ok) return couldNotCheck(current.error);
  if (current.value.code === 0) return R.success(identified);
  const blocker = await updateBlocker(git, main);
  if (!blocker.ok) return couldNotCheck(blocker.error);
  return R.success({ ...identified, outdated: { blocker: blocker.value } });
}

export async function updateBlocker(
  git: Git,
  folder: string,
): Promise<Result<UpdateBlocker | undefined, Error>> {
  const branch = await git.query([
    "-C",
    folder,
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  ]);
  if (!branch.ok) return branch;
  if (branch.value.code !== 0)
    return R.success({ kind: UpdateBlockerKind.Detached });
  const name = branch.value.stdout.trim();
  if (name !== "main")
    return R.success({ kind: UpdateBlockerKind.OnBranch, branch: name });
  const changes = await git.output([
    "-C",
    folder,
    "status",
    "--porcelain",
    "--untracked-files=no",
  ]);
  if (!changes.ok) return changes;
  return R.success(
    changes.value.trim() ? { kind: UpdateBlockerKind.Uncommitted } : undefined,
  );
}

/** The remote fetching url, so fetching main through it moves its tracking ref too, else url itself, as for a copy whose remotes are all forks. */
export async function fetchTarget(params: {
  git: Git;
  folder: string;
  url: string;
}): Promise<Result<string, Error>> {
  const { git, folder, url } = params;
  const remotes = await git.query([
    "-C",
    folder,
    "config",
    "--get-regexp",
    "^remote\\..*\\.url$",
  ]);
  if (!remotes.ok) return remotes;
  const matching = remotes.value.stdout
    .split("\n")
    .map((line) => /^remote\.(.+)\.url (.+)$/.exec(line))
    .find((match) => match && sameRepository(match[2], url));
  return R.success(matching?.[1] ?? url);
}

/** Compares host and path, so the SSH and HTTPS forms of one repository match. */
const sameRepository = (a: string, b: string) =>
  repositoryKey(a) === repositoryKey(b);

function repositoryKey(url: string): string {
  const scp = url.includes("://")
    ? undefined
    : /^(?:[^/@]+@)?([^/:]+):(.+)$/.exec(url);
  const parsed = URL.parse(scp ? `ssh://${scp[1]}/${scp[2]}` : url);
  if (!parsed?.hostname) return url;
  return `${parsed.hostname}${parsed.pathname}`
    .toLowerCase()
    .replace(/(\.git)?\/*$/, "");
}
