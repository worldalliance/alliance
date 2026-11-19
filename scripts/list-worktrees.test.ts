import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { slotPorts } from "../common/src/dev-ports-base";
import { fixtureGit } from "./lib/fixture-git";
import { WorktreeFixture } from "./lib/worktree-fixture";
import { listWorktrees, WorktreeState } from "./list-worktrees";

const TIMEOUT = 120_000;
const SCRIPT = join(import.meta.dir, "list-worktrees.ts");

let f: WorktreeFixture;

beforeEach(() => {
  f = new WorktreeFixture();
});

afterEach(() => {
  f.cleanup();
});

const untouched = { problem: null, locked: false, prunable: false };

function recorded(name: string) {
  const record = f.record(name);
  return {
    path: f.dir(name),
    state: WorktreeState.Recorded,
    ...untouched,
    id: record.id,
    name,
    branch: name,
    parent: record.parent,
    ports: slotPorts(Number(record.slot)),
  };
}

const main = () => ({
  path: f.main,
  state: WorktreeState.Main,
  ...untouched,
  id: null,
  name: null,
  branch: "main",
  parent: null,
  ports: slotPorts(0),
});

const entry = (path: string) =>
  listWorktrees(f.main).worktrees.find((worktree) => worktree.path === path);

test(
  "lists the main checkout and a child worktree, from any checkout",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    expect(f.create("b", { cwd: f.dir("a") }).exitCode).toBe(0);
    expect(f.record("b").parent).toBe(f.record("a").id);

    const expected = {
      version: 1,
      worktrees: [main(), recorded("a"), recorded("b")],
    };
    expect(listWorktrees(f.main)).toEqual(expected);

    const cli = spawnSync(process.execPath, [SCRIPT], {
      cwd: f.dir("b"),
      encoding: "utf8",
    });
    expect(cli.stderr).toBe("");
    expect(cli.status).toBe(0);
    const printed = JSON.parse(cli.stdout);
    expect(printed).toEqual(expected);
    expect(Object.keys(printed)).toEqual(["version", "worktrees"]);
    expect(Object.keys(printed.worktrees[1])).toEqual([
      "path",
      "state",
      "problem",
      "id",
      "name",
      "branch",
      "parent",
      "ports",
      "locked",
      "prunable",
    ]);
  },
  TIMEOUT,
);

test(
  "lists a record a removal flagged and did not delete as half-removed",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    f.touch("fail-drop-alliance_a");
    expect(f.remove(["a"]).exitCode).not.toBe(0);

    expect(entry(f.dir("a"))).toEqual({
      ...recorded("a"),
      state: WorktreeState.HalfRemoved,
    });
  },
  TIMEOUT,
);

test(
  "lists a creation that stopped before its checkout as a half-created record with no git worktree",
  () => {
    f.touch("fail-comment");
    expect(f.create("a").exitCode).not.toBe(0);

    expect(listWorktrees(f.main).worktrees).toEqual([
      main(),
      { ...recorded("a"), state: WorktreeState.HalfCreated },
    ]);
  },
  TIMEOUT,
);

test(
  "lists a creation that is running or stopped after writing .worktree/ports.json as half-created",
  async () => {
    f.touch("hold-install");
    const { proc } = f.spawn({ script: "new-worktree.sh", args: ["a"] });
    await f.reached("hold-install", proc);
    const halfCreated = { ...recorded("a"), state: WorktreeState.HalfCreated };
    expect(entry(f.dir("a"))).toEqual(halfCreated);

    proc.kill("SIGKILL");
    await proc.exited;
    f.release("hold-install");
    expect(entry(f.dir("a"))).toEqual(halfCreated);
  },
  TIMEOUT,
);

test(
  "lists a record from before the created field by its .worktree/ports.json",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    const file = f.recordPath("a");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace(/^created=.*\n/m, ""),
    );
    expect(entry(f.dir("a"))?.state).toBe(WorktreeState.Recorded);

    rmSync(join(f.dir("a"), ".worktree", "ports.json"));
    expect(entry(f.dir("a"))?.state).toBe(WorktreeState.HalfCreated);
  },
  TIMEOUT,
);

test(
  "joins a checkout without an instance file to the record naming its directory",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    const gitDir = f.git(f.dir("a"), "rev-parse", "--absolute-git-dir");
    rmSync(join(gitDir, "alliance-instance"));

    expect(listWorktrees(f.main).worktrees).toEqual([
      main(),
      { ...recorded("a"), state: WorktreeState.HalfCreated },
    ]);
  },
  TIMEOUT,
);

test("lists a plain git worktree as unrecorded, with git's flags and its own ports", () => {
  f.addUnrecorded({ name: "old", slot: 7 });
  fixtureGit(f.main, "worktree", "add", "-q", "-b", "plain", f.dir("plain"));
  fixtureGit(f.main, "worktree", "lock", f.dir("plain"));
  fixtureGit(f.main, "worktree", "add", "-q", "-b", "gone", f.dir("gone"));
  rmSync(f.dir("gone"), { recursive: true });
  const unrecorded = {
    state: WorktreeState.Unrecorded,
    ...untouched,
    id: null,
    name: null,
    parent: null,
  };

  expect(listWorktrees(f.main).worktrees).toEqual([
    main(),
    {
      ...unrecorded,
      path: f.dir("gone"),
      branch: "gone",
      ports: null,
      prunable: true,
    },
    { ...unrecorded, path: f.dir("old"), branch: "old", ports: slotPorts(7) },
    {
      ...unrecorded,
      path: f.dir("plain"),
      branch: "plain",
      ports: slotPorts(0),
      locked: true,
    },
  ]);
});

test("reports an unreadable ports.json as the entry's problem", () => {
  f.addUnrecorded({ name: "old", slot: 7 });
  writeFileSync(join(f.dir("old"), ".worktree", "ports.json"), "{");

  expect(entry(f.dir("old"))).toMatchObject({
    state: WorktreeState.Unrecorded,
    ports: null,
    problem: expect.stringContaining("ports.json is malformed"),
  });
});

test(
  "reports a recorded checkout's unreadable, mismatched or missing ports.json as its problem",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    expect(f.create("b").exitCode).toBe(0);
    expect(f.create("c").exitCode).toBe(0);
    writeFileSync(join(f.dir("a"), ".worktree", "ports.json"), "{");
    rmSync(join(f.dir("c"), ".worktree", "ports.json"));
    const portsFile = join(f.dir("b"), ".worktree", "ports.json");
    const ports = JSON.parse(readFileSync(portsFile, "utf8"));
    writeFileSync(portsFile, JSON.stringify({ ...ports, server: 3999 }));

    expect(entry(f.dir("a"))).toEqual({
      ...recorded("a"),
      ports: null,
      problem: expect.stringContaining("ports.json is malformed"),
    });
    expect(entry(f.dir("b"))).toEqual({
      ...recorded("b"),
      ports: { ...recorded("b").ports, server: 3999 },
      problem: expect.stringContaining("but the record's slot"),
    });
    expect(entry(f.dir("c"))).toEqual({
      ...recorded("c"),
      ports: slotPorts(0),
      problem: expect.stringContaining("has no .worktree/ports.json"),
    });
  },
  TIMEOUT,
);

test("lists a worktree whose .git is a directory instead of failing", () => {
  fixtureGit(f.main, "worktree", "add", "-q", "-b", "plain", f.dir("plain"));
  rmSync(join(f.dir("plain"), ".git"));
  fixtureGit(f.dir("plain"), "init", "-q");

  expect(entry(f.dir("plain"))).toMatchObject({
    state: WorktreeState.Unrecorded,
    problem: null,
  });
});

test(
  "lists a record record_problem rejects as invalid, with its problem",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    const file = f.recordPath("a");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace(/^db=.*$/m, "db=alliance_other"),
    );

    expect(entry(f.dir("a"))).toEqual({
      ...recorded("a"),
      state: WorktreeState.Invalid,
      problem: "names databases other than alliance_a and alliance_a_test",
      ports: null,
    });
  },
  TIMEOUT,
);

test(
  "lists a checkout whose instance file names no record as invalid",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    const { id } = f.record("a");
    rmSync(join(f.instances(), id), { recursive: true });

    expect(entry(f.dir("a"))).toEqual({
      path: f.dir("a"),
      state: WorktreeState.Invalid,
      problem: `has an instance file naming record ${id}, which does not exist`,
      id,
      name: null,
      branch: "a",
      parent: null,
      ports: null,
      locked: false,
      prunable: false,
    });
  },
  TIMEOUT,
);

test(
  "lists a checkout whose instance file names another checkout's record as invalid",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    expect(f.create("b").exitCode).toBe(0);
    const instanceFile = join(
      f.git(f.dir("b"), "rev-parse", "--absolute-git-dir"),
      "alliance-instance",
    );
    writeFileSync(instanceFile, `${f.record("a").id}\n`);

    expect(listWorktrees(f.main).worktrees).toEqual([
      main(),
      recorded("a"),
      {
        ...recorded("a"),
        path: f.dir("b"),
        branch: "b",
        state: WorktreeState.Invalid,
        problem: `names ${f.dir("a")}, but the instance file in ${f.dir("b")} names this record; record ${f.record("b").id} names this directory`,
        ports: null,
      },
    ]);
  },
  TIMEOUT,
);

test("prints its usage for --help and refuses arguments", () => {
  const help = spawnSync(process.execPath, [SCRIPT, "--help"], {
    encoding: "utf8",
  });
  expect(help.status).toBe(0);
  expect(help.stdout).toContain("usage: bun scripts/list-worktrees.ts");

  const extra = spawnSync(process.execPath, [SCRIPT, "x"], {
    encoding: "utf8",
  });
  expect(extra.status).toBe(2);
  expect(extra.stderr).toContain("usage:");

  const helpAndExtra = spawnSync(process.execPath, [SCRIPT, "--help", "x"], {
    encoding: "utf8",
  });
  expect(helpAndExtra.status).toBe(2);
  expect(helpAndExtra.stdout).toBe("");
  expect(helpAndExtra.stderr).toContain("usage:");
});
