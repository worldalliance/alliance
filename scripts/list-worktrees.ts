import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PortCaller, resolveDevPorts } from "../common/src/dev-ports";
import { type DevService, slotPorts } from "../common/src/dev-ports-base";

const USAGE = `usage: bun scripts/list-worktrees.ts

Prints every worktree of the repository holding the working directory as JSON,
joining the worktrees git knows to the records scripts/new-worktree.sh keeps,
and listing records git has no worktree for after them.

{ "version": 1, "worktrees": [entry, ...] }

version changes only when a change would break a reader; new fields leave it.
Each entry has:

  path      the checkout's directory; null for a record naming none
  state     main | recorded | unrecorded | half-created | half-removed | invalid
  problem   what is wrong with the entry, or null
  id        its record's id, or null without a record
  name      its record's name, or null without a record
  branch    the branch checked out, else the record's; null when detached
  parent    "main" or the parent record's id; null without a record
  ports     { server, frontend, admin, mobile }, or null when unknown
  locked    git holds it locked
  prunable  git would prune it, its directory being gone

unrecorded is a worktree no record claims, such as one made by plain
'git worktree add'. half-removed is a record a removal flagged and did not
delete. half-created is any other record whose new-worktree.sh run did not
finish, or whose checkout lacks its directory, git registration or instance
file. Neither tells an operation still running from one that stopped.
invalid is a record scripts/lib/worktree-registry.sh's record_problem rejects,
an instance file naming no record, or one naming another checkout's record.
Each path appears once: a record naming the directory of a checkout whose
instance file names another record shows only in that checkout's problem.

The main checkout's and unrecorded worktrees' ports are those in their
.worktree/ports.json, else the base ports; SERVER_PORT and the like set in
their .env files or the shell are not read.`;

const LIST_VERSION = 1;

export enum WorktreeState {
  Main = "main",
  Recorded = "recorded",
  Unrecorded = "unrecorded",
  HalfCreated = "half-created",
  HalfRemoved = "half-removed",
  Invalid = "invalid",
}

type Entry = {
  path: string | null;
  state: WorktreeState;
  problem: string | null;
  id: string | null;
  name: string | null;
  branch: string | null;
  parent: string | null;
  ports: Record<DevService, number> | null;
  locked: boolean;
  prunable: boolean;
};

type GitWorktree = {
  path: string;
  branch: string | null;
  locked: boolean;
  prunable: boolean;
};

type InstanceRecord = {
  id: string;
  fields: Map<string, string>;
  problem: string;
  removing: boolean;
};

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.error ?? result.stderr}`,
    );
  }
  return result.stdout;
}

function readIfExists(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if (["ENOENT", "ENOTDIR", "EISDIR"].includes(String(error.code))) {
        return null;
      }
    }
    throw error;
  }
}

function gitWorktrees(repo: string): GitWorktree[] {
  const worktrees: GitWorktree[] = [];
  const out = run("git", ["-C", repo, "worktree", "list", "--porcelain", "-z"]);
  for (const attribute of out.split("\0")) {
    const at = attribute.indexOf(" ");
    const key = at === -1 ? attribute : attribute.slice(0, at);
    const value = at === -1 ? "" : attribute.slice(at + 1);
    if (key === "worktree") {
      worktrees.push({
        path: value,
        branch: null,
        locked: false,
        prunable: false,
      });
      continue;
    }
    const current = worktrees.at(-1);
    if (key === "" || !current) continue;
    if (key === "branch") current.branch = value.replace(/^refs\/heads\//, "");
    if (key === "locked") current.locked = true;
    if (key === "prunable") current.prunable = true;
  }
  return worktrees;
}

// record_problem stays the one validator, so this listing and rm-worktree.sh
// cannot disagree about which records are sound.
function recordProblems(repo: string): Map<string, string> {
  const lib = path.join(import.meta.dir, "lib");
  const out = run("bash", [
    "-c",
    `set -euo pipefail
repo_root="$1"
source "$2/worktree-paths.sh"
source "$2/worktree-registry.sh"
for dir in "$instances"/*/; do
  [[ -d "$dir" ]] || continue
  id="$(basename "$dir")"
  printf '%s\\0%s\\0' "$id" "$(record_problem "$id")"
done`,
    "list-worktrees",
    repo,
    lib,
  ]);
  const fields = out.split("\0");
  const problems = new Map<string, string>();
  for (let i = 0; i + 1 < fields.length; i += 2) {
    problems.set(fields[i], fields[i + 1]);
  }
  return problems;
}

function readRecords(params: {
  repo: string;
  instances: string;
}): InstanceRecord[] {
  return [...recordProblems(params.repo)].flatMap(([id, problem]) => {
    const dir = path.join(params.instances, id);
    // A removal moves a finished record's directory away whole, which can
    // happen after the scan above.
    if (!fs.existsSync(dir)) return [];
    const fields = new Map<string, string>();
    // record_field takes a key's first line.
    for (const line of (readIfExists(path.join(dir, "record")) ?? "").split(
      "\n",
    )) {
      const at = line.indexOf("=");
      if (at > 0 && !fields.has(line.slice(0, at))) {
        fields.set(line.slice(0, at), line.slice(at + 1));
      }
    }
    const removing =
      fs.lstatSync(path.join(dir, "removing"), { throwIfNoEntry: false }) !==
      undefined;
    return [{ id, fields, problem, removing }];
  });
}

// Resolved like admin_dir_of in scripts/lib/worktree-paths.sh, lexically,
// since a relative gitdir is written relative to the checkout.
function instanceId(checkout: string): string | null {
  const gitFile = readIfExists(path.join(checkout, ".git"));
  const gitDir = gitFile && /^gitdir: (.*)$/m.exec(gitFile)?.[1];
  if (!gitDir) return null;
  const file = path.join(path.resolve(checkout, gitDir), "alliance-instance");
  return readIfExists(file)?.trim() ?? null;
}

function checkoutPorts(checkout: string): Pick<Entry, "ports" | "problem"> {
  if (!fs.existsSync(path.join(checkout, ".git"))) {
    return { ports: null, problem: null };
  }
  try {
    const { server, frontend, admin, mobile } = resolveDevPorts(
      PortCaller.Tooling,
      { cwd: checkout, env: {} },
    );
    return { ports: { server, frontend, admin, mobile }, problem: null };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { ports: null, problem: error.message };
  }
}

function recordEntry(params: {
  record: InstanceRecord;
  git: GitWorktree | null;
  claimedByInstanceFile: boolean;
}): Entry {
  const { record, git } = params;
  const field = (key: string) => record.fields.get(key) || null;
  const dir = field("dir");
  const base = {
    path: git?.path ?? dir,
    id: record.id,
    name: field("name"),
    branch: git ? git.branch : field("branch"),
    parent: field("parent"),
    locked: git?.locked ?? false,
    prunable: git?.prunable ?? false,
  };
  if (record.problem) {
    return {
      ...base,
      state: WorktreeState.Invalid,
      problem: record.problem,
      ports: null,
    };
  }
  if (git && git.path !== dir) {
    return {
      ...base,
      state: WorktreeState.Invalid,
      problem: `names ${dir}, but the instance file in ${git.path} names this record`,
      ports: null,
    };
  }
  // BACKCOMPAT(worktree-created-field): a record without `created` predates the
  // field, so its ports.json stands in. Remove once no record lacks the field.
  const created = field("created");
  const finished =
    created === null
      ? git !== null &&
        fs.existsSync(path.join(git.path, ".worktree", "ports.json"))
      : created === "1";
  const complete =
    git !== null && !git.prunable && params.claimedByInstanceFile && finished;
  const state = record.removing
    ? WorktreeState.HalfRemoved
    : complete
      ? WorktreeState.Recorded
      : WorktreeState.HalfCreated;
  const claimed = slotPorts(Number(field("slot")));
  if (!complete) return { ...base, state, problem: null, ports: claimed };
  const own = checkoutPorts(git.path);
  const portsProblem = !fs.existsSync(
    path.join(git.path, ".worktree", "ports.json"),
  )
    ? `has no .worktree/ports.json, so its dev servers bind the base ports, not slot ${field("slot")}'s`
    : own.ports && !Bun.deepEquals(own.ports, claimed)
      ? `.worktree/ports.json has ports ${JSON.stringify(own.ports)}, but the record's slot ${field("slot")} claims ${JSON.stringify(claimed)}`
      : null;
  return {
    ...base,
    state,
    ports: own.ports,
    problem: own.problem ?? portsProblem,
  };
}

function inUsageOrder(entry: Entry): Entry {
  return {
    path: entry.path,
    state: entry.state,
    problem: entry.problem,
    id: entry.id,
    name: entry.name,
    branch: entry.branch,
    parent: entry.parent,
    ports: entry.ports,
    locked: entry.locked,
    prunable: entry.prunable,
  };
}

export function listWorktrees(repo: string): {
  version: number;
  worktrees: Entry[];
} {
  const commonDir = run("git", [
    "-C",
    repo,
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]).trim();
  const instances = path.join(commonDir, "alliance-worktrees", "instances");
  const records = new Map(
    readRecords({ repo, instances }).map((record) => [record.id, record]),
  );
  const worktrees = gitWorktrees(repo);
  const claims = worktrees.map((git, index) =>
    index === 0 ? null : instanceId(git.path),
  );
  const unclaimed = new Map(records);
  for (const id of claims) if (id) unclaimed.delete(id);

  const byDir = (dir: string) =>
    [...unclaimed.values()].find((record) => record.fields.get("dir") === dir);

  const claimedEntry = (git: GitWorktree, claim: string): Entry => {
    const record = records.get(claim);
    if (record) {
      return recordEntry({ record, git, claimedByInstanceFile: true });
    }
    return {
      path: git.path,
      state: WorktreeState.Invalid,
      problem: `has an instance file naming record ${claim}, which does not exist`,
      id: claim,
      name: null,
      branch: git.branch,
      parent: null,
      ports: null,
      locked: git.locked,
      prunable: git.prunable,
    };
  };

  const entries = worktrees.map((git, index): Entry => {
    const flags = { locked: git.locked, prunable: git.prunable };
    const none = { id: null, name: null, parent: null, branch: git.branch };
    if (index === 0) {
      return {
        path: git.path,
        state: WorktreeState.Main,
        ...none,
        ...flags,
        ...checkoutPorts(git.path),
      };
    }
    const claim = claims[index];
    const own = byDir(git.path);
    if (own) unclaimed.delete(own.id);
    if (claim) {
      const entry = claimedEntry(git, claim);
      if (!own) return entry;
      const also = `record ${own.id} names this directory`;
      return {
        ...entry,
        problem: entry.problem ? `${entry.problem}; ${also}` : also,
      };
    }
    if (own) {
      return recordEntry({ record: own, git, claimedByInstanceFile: false });
    }
    return {
      path: git.path,
      state: WorktreeState.Unrecorded,
      ...none,
      ...flags,
      ...checkoutPorts(git.path),
    };
  });

  const orphans = [...unclaimed.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((record) =>
      recordEntry({ record, git: null, claimedByInstanceFile: false }),
    );

  return {
    version: LIST_VERSION,
    worktrees: [...entries, ...orphans].map(inUsageOrder),
  };
}

if (import.meta.main) {
  if (process.argv.length > 2) {
    const help =
      ["-h", "--help"].includes(process.argv[2]) && process.argv.length === 3;
    (help ? console.log : console.error)(USAGE);
    process.exit(help ? 0 : 2);
  }
  const repo = run("git", ["rev-parse", "--show-toplevel"]).trim();
  console.log(JSON.stringify(listWorktrees(repo), null, 2));
}
