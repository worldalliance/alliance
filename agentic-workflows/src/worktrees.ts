import { R, type Result } from "@alliance/common/result";
import { basename, dirname } from "node:path";
import { z } from "zod";
import { gitText, lines } from "./git";
import type {
  Commit,
  FileChange,
  WorktreeDetail,
  WorktreePorts,
  WorktreeSummary,
} from "./types";

const portsSchema = z.object({
  server: z.number(),
  frontend: z.number(),
  admin: z.number(),
  mobile: z.number(),
  database: z.string(),
  testDatabase: z.string(),
});

async function resolve(args: string[], cwd: string): Promise<string> {
  const result = await gitText({ args, cwd });
  if (!result.ok) throw new Error(result.error);
  return result.value.trim();
}

/** The checkout this panel's own files live in; it must never remove itself. */
export const panelRoot = await resolve(
  ["rev-parse", "--show-toplevel"],
  import.meta.dir,
);

/**
 * scripts/new-worktree.sh refuses to run inside a linked worktree, so every
 * script this panel spawns runs in the main checkout's copy.
 */
export const mainRoot = dirname(
  await resolve(
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    import.meta.dir,
  ),
);

function worktreeName(path: string): string {
  return path === mainRoot
    ? basename(path)
    : basename(path).replace(/^alliance-/, "");
}

async function readPorts(path: string): Promise<WorktreePorts | null> {
  const file = await R.fromPromiseFn(() =>
    Bun.file(`${path}/.worktree/ports.json`).json(),
  );
  if (!file.ok) return null;

  const parsed = portsSchema.safeParse(file.value);
  return parsed.success ? parsed.data : null;
}

export async function listWorktrees(): Promise<
  Result<WorktreeSummary[], string>
> {
  const listed = await gitText({
    args: ["worktree", "list", "--porcelain"],
    cwd: mainRoot,
  });
  if (!listed.ok) return listed;

  const summaries: WorktreeSummary[] = [];
  for (const block of listed.value.split("\n\n")) {
    const fields = new Map(
      lines(block).map((line) => {
        const space = line.indexOf(" ");
        return space === -1
          ? ([line, ""] as const)
          : ([line.slice(0, space), line.slice(space + 1)] as const);
      }),
    );

    const path = fields.get("worktree");
    const head = fields.get("HEAD");
    if (!path || !head) continue;

    const branch = fields.get("branch");
    summaries.push({
      path,
      name: worktreeName(path),
      branch: branch ? branch.replace(/^refs\/heads\//, "") : null,
      head,
      isMain: path === mainRoot,
      isPanel: path === panelRoot,
      ports: await readPorts(path),
    });
  }

  return R.success(summaries);
}

enum ChangeLine {
  Ordinary = "1",
  Renamed = "2",
  Unmerged = "u",
  Untracked = "?",
  Ignored = "!",
}

const CHANGE_PATH_INDEX: Record<ChangeLine, number> = {
  [ChangeLine.Ordinary]: 8,
  [ChangeLine.Renamed]: 9,
  [ChangeLine.Unmerged]: 10,
  [ChangeLine.Untracked]: 1,
  [ChangeLine.Ignored]: 1,
};

const CHANGE_CODE: Record<ChangeLine, ((fields: string[]) => string) | null> = {
  [ChangeLine.Ordinary]: (fields) => fields[1] ?? "",
  [ChangeLine.Renamed]: (fields) => fields[1] ?? "",
  [ChangeLine.Unmerged]: (fields) => fields[1] ?? "",
  [ChangeLine.Untracked]: () => "??",
  [ChangeLine.Ignored]: null,
};

const changeLineSchema = z.enum(ChangeLine);

type StatusState = {
  upstream: string | null;
  ahead: number;
  behind: number;
  changes: FileChange[];
};

function parseStatus(output: string): StatusState {
  const state: StatusState = {
    upstream: null,
    ahead: 0,
    behind: 0,
    changes: [],
  };

  for (const line of lines(output)) {
    if (line.startsWith("# branch.upstream ")) {
      state.upstream = line.slice("# branch.upstream ".length);
      continue;
    }
    if (line.startsWith("# branch.ab ")) {
      const [ahead, behind] = line.slice("# branch.ab ".length).split(" ");
      state.ahead = Number(ahead);
      state.behind = Math.abs(Number(behind));
      continue;
    }
    if (line.startsWith("#")) continue;

    const fields = line.split(" ");
    const kind = changeLineSchema.safeParse(fields[0]);
    if (!kind.success) continue;

    const code = CHANGE_CODE[kind.data];
    if (!code) continue;

    const path = fields.slice(CHANGE_PATH_INDEX[kind.data]).join(" ");
    state.changes.push({
      code: code(fields),
      path: path.split("\t")[0] ?? path,
    });
  }

  return state;
}

/** %x1f expands in git's output, so the argument itself carries no odd byte. */
const LOG_SEPARATOR = "%x1f";

const DEFAULT_BASE = "origin/main";

function decorations(value: string): string[] {
  return value
    .split(", ")
    .flatMap((ref) => ref.split(" -> "))
    .filter((ref) => ref.length > 0);
}

function githubUrl(params: {
  remoteUrl: string;
  branch: string;
}): string | null {
  const repo = params.remoteUrl
    .trim()
    .match(/^(?:git@github\.com:|https:\/\/github\.com\/)(.+?)(?:\.git)?$/);
  if (!repo?.[1]) return null;

  return `https://github.com/${repo[1]}/tree/${params.branch}`;
}

/**
 * Branches of the default remote first: the other remotes are forks, and
 * listing them alongside origin buries it.
 */
function remoteBranchNames(refs: string[]): string[] {
  const [remote] = DEFAULT_BASE.split("/");

  return refs
    .filter((ref) => ref.includes("/") && !ref.endsWith("/HEAD"))
    .sort((a, b) => {
      const own =
        Number(b.startsWith(`${remote}/`)) - Number(a.startsWith(`${remote}/`));
      return own || a.localeCompare(b);
    });
}

/** Only the upstream has a branch that is known to exist on the remote. */
async function remoteLink(params: {
  path: string;
  upstream: string | null;
}): Promise<string | null> {
  if (!params.upstream) return null;

  const remote = params.upstream.split("/")[0] ?? "origin";
  const url = await gitText({
    args: ["remote", "get-url", remote],
    cwd: params.path,
  });
  if (!url.ok) return null;

  return githubUrl({
    remoteUrl: url.value,
    branch: params.upstream.slice(remote.length + 1),
  });
}

const SHORTSTAT = /^ \d+ files? changed/;

function countIn(params: { line: string; noun: string }): number {
  const match = new RegExp(`(\\d+) ${params.noun}s?\\(`).exec(params.line);
  return match?.[1] ? Number(match[1]) : 0;
}

async function commitLog(params: {
  revisions: string[];
  limit: number;
  cwd: string;
}): Promise<Result<Commit[], string>> {
  const log = await gitText({
    args: [
      "log",
      `--max-count=${params.limit}`,
      "--shortstat",
      `--format=%h${LOG_SEPARATOR}%D${LOG_SEPARATOR}%s`,
      ...params.revisions,
    ],
    cwd: params.cwd,
  });
  if (!log.ok) return log;

  const commits: Commit[] = [];
  for (const line of lines(log.value)) {
    const current = commits[commits.length - 1];
    if (SHORTSTAT.test(line) && current) {
      current.added = countIn({ line, noun: "insertion" });
      current.removed = countIn({ line, noun: "deletion" });
      continue;
    }

    const [sha, decoration, subject] = line.split("\u001f");
    if (sha === undefined || subject === undefined) continue;

    commits.push({
      sha,
      refs: decorations(decoration ?? ""),
      subject,
      added: 0,
      removed: 0,
    });
  }

  return R.success(commits);
}

export async function worktreeDetail(params: {
  path: string;
  branch: string | null;
  base: string | null;
}): Promise<Result<WorktreeDetail, string>> {
  const status = await gitText({
    args: ["status", "--porcelain=v2", "--branch"],
    cwd: params.path,
  });
  if (!status.ok) return status;

  const state = parseStatus(status.value);
  const requested = params.base;
  const resolves =
    requested !== null &&
    (
      await gitText({
        args: ["rev-parse", "--verify", "--quiet", requested],
        cwd: params.path,
      })
    ).ok;
  const baseRef =
    resolves && requested ? requested : (state.upstream ?? DEFAULT_BASE);
  const commitRange = `${baseRef}..HEAD`;

  const log = await commitLog({
    revisions: [commitRange],
    limit: 50,
    cwd: params.path,
  });
  if (!log.ok) return log;

  const baseCommits: Commit[] = [];
  for (const ref of new Set([baseRef, DEFAULT_BASE])) {
    const tip = await commitLog({
      revisions: [ref],
      limit: 1,
      cwd: params.path,
    });
    const commit = tip.ok ? tip.value[0] : undefined;
    if (commit && !baseCommits.some((base) => base.sha === commit.sha)) {
      baseCommits.push(commit);
    }
  }

  const refs = await gitText({
    args: ["for-each-ref", "--format=%(refname:short)", "refs/remotes"],
    cwd: params.path,
  });
  if (!refs.ok) return refs;

  return R.success({
    path: params.path,
    upstream: state.upstream,
    ahead: state.ahead,
    behind: state.behind,
    changes: state.changes,
    base: baseRef,
    commitRange,
    commits: log.value,
    baseCommits,
    githubUrl: await remoteLink({
      path: params.path,
      upstream: state.upstream,
    }),
    remoteBranches: remoteBranchNames(lines(refs.value)),
  });
}
