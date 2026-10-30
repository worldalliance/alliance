import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fixtureGit } from "./lib/fixture-git";
import { WorktreeFixture } from "./lib/worktree-fixture";

const TIMEOUT = 120_000;

let f: WorktreeFixture;

beforeEach(() => {
  f = new WorktreeFixture();
});

afterEach(() => {
  f.cleanup();
});

test(
  "new-worktree.sh records the main checkout as parent, starts at its HEAD or --from, and copies config from it",
  () => {
    const initial = f.git(f.main, "rev-parse", "HEAD");
    f.commit(f.main, "later.txt");
    expect(f.create("a").exitCode).toBe(0);
    expect(f.create("b", { args: ["--from", initial] }).exitCode).toBe(0);

    expect(f.git(f.dir("a"), "rev-parse", "HEAD")).toBe(
      f.git(f.main, "rev-parse", "HEAD"),
    );
    expect(f.git(f.dir("b"), "rev-parse", "HEAD")).toBe(initial);
    expect(f.record("a").slot).not.toBe(f.record("b").slot);
    for (const name of ["a", "b"]) {
      expect(f.record(name).parent).toBe("main");
      const env = readFileSync(join(f.dir(name), "server", ".env"), "utf8");
      expect(env).toContain("SOURCE=main");
      expect(env).toContain(`DB_NAME=alliance_${name}`);
      const tag = `alliance-worktree:${f.record(name).id}`;
      expect(f.dbComment(`alliance_${name}`)).toBe(tag);
      expect(f.dbComment(`alliance_${name}_test`)).toBe(tag);
      expect(f.instanceId(name)).toBe(f.record(name).id);
    }
  },
  TIMEOUT,
);

test(
  "new-worktree.sh sets the new branch's upstream as branch.autoSetupMerge says",
  () => {
    f.git(f.main, "config", "remote.origin.url", f.main);
    f.git(
      f.main,
      "config",
      "remote.origin.fetch",
      "+refs/heads/*:refs/remotes/origin/*",
    );
    f.git(f.main, "update-ref", "refs/remotes/origin/main", "HEAD");
    f.git(f.main, "update-ref", "refs/unfetched/main", "HEAD");

    for (const [name, from] of [
      ["remote", "origin/main"],
      ["local", "HEAD"],
      ["unfetched", "refs/unfetched/main"],
    ]) {
      expect(f.create(name, { args: ["--from", from] }).exitCode).toBe(0);
    }
    f.git(f.main, "config", "branch.autoSetupMerge", "false");
    expect(
      f.create("optout", { args: ["--from", "origin/main"] }).exitCode,
    ).toBe(0);

    const upstream = (branch: string) =>
      f.git(
        f.main,
        "for-each-ref",
        "--format=%(upstream)",
        `refs/heads/${branch}`,
      );
    expect(upstream("remote")).toBe("refs/remotes/origin/main");
    expect(upstream("local")).toBe("");
    expect(upstream("unfetched")).toBe("");
    expect(upstream("optout")).toBe("");
  },
  TIMEOUT,
);

test(
  "new-worktree.sh refuses a name, database or branch that another worktree holds",
  () => {
    expect(f.create("foo").exitCode).toBe(0);

    expect(f.create("foo").stderr).toContain(
      "a worktree named foo is already recorded, and someone may be using it — choose another name",
    );
    expect(f.create("foo-test").stderr).toContain(
      "database alliance_foo_test belongs to another worktree",
    );
    expect(f.create("other", { args: ["--branch", "foo"] }).stderr).toContain(
      "branch foo belongs to worktree foo",
    );
    expect(f.records().map((r) => r.name)).toEqual(["foo"]);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh refuses a branch named by checkout history",
  () => {
    f.git(f.main, "checkout", "-q", "-b", "other");
    f.git(f.main, "checkout", "-q", "-");

    const result = f.create("foo", { args: ["--branch", "@{-1}"] });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("invalid branch name: @{-1}");
    expect(f.records()).toEqual([]);
    expect(f.databases()).not.toContain("alliance_foo");
  },
  TIMEOUT,
);

test(
  "new-worktree.sh skips the slots of idle worktrees created before records",
  () => {
    expect(f.create("probe-1").exitCode).toBe(0);
    expect(f.create("probe-2").exitCode).toBe(0);
    const slots = [f.record("probe-1").slot, f.record("probe-2").slot];
    expect(f.remove(["probe-1"]).exitCode).toBe(0);
    expect(f.remove(["probe-2"]).exitCode).toBe(0);
    f.addUnrecorded({ name: "old", slot: Number(slots[0]) });
    f.addUnrecorded({ name: "older", slot: Number(slots[1]), envOnly: true });

    expect(f.create("a").exitCode).toBe(0);

    expect(slots).not.toContain(f.record("a").slot);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh deletes what stopped runs left in the registry",
  () => {
    mkdirSync(join(f.instances(), ".new-stopped"), { recursive: true });
    mkdirSync(join(f.instances(), ".deleted-stopped-99999999"));
    mkdirSync(join(f.instances(), `.deleted-running-${process.pid}`));

    expect(f.create("a").exitCode).toBe(0);

    expect(readdirSync(f.instances()).filter((d) => d.startsWith("."))).toEqual(
      [`.deleted-running-${process.pid}`],
    );
  },
  TIMEOUT,
);

test(
  "new-worktree.sh leaves an interrupted creation recorded, so rm-worktree.sh removes all of it",
  async () => {
    f.touch("hold-install");
    const { proc } = f.spawn({ script: "new-worktree.sh", args: ["cut"] });
    await f.reached("hold-install", proc);
    proc.kill("SIGKILL");
    await proc.exited;
    f.release("hold-install");

    expect(f.record("cut").name).toBe("cut");
    const removal = f.remove(["cut"]);

    expect(removal.exitCode).toBe(0);
    expect(f.records()).toEqual([]);
    expect(f.databases()).toEqual(["fixture_main"]);
    expect(f.branchExists("cut")).toBe(false);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh falls back to dump/restore, tagging the database so rm-worktree.sh removes it even after a failed restore",
  () => {
    f.touch("fail-template");
    expect(f.create("ok").exitCode).toBe(0);
    expect(f.dbComment("alliance_ok")).toBe(
      `alliance-worktree:${f.record("ok").id}`,
    );

    f.touch("fail-restore");
    const result = f.create("bad");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "restoring fixture_main into alliance_bad failed",
    );
    expect(f.dbComment(f.stagingDb("bad"))).toBe(
      `alliance-worktree:${f.record("bad").id}`,
    );
    expect(f.remove(["bad"]).exitCode).toBe(0);
    expect(f.gone("bad")).toBe(true);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh refuses a branch another worktree holds, even after that worktree switched away from it",
  () => {
    expect(f.create("r1").exitCode).toBe(0);
    fixtureGit(f.dir("r1"), "switch", "-q", "-c", "elsewhere");

    const second = f.create("r2", { args: ["--branch", "r1"] });

    expect(second.exitCode).toBe(1);
    expect(second.stderr).toContain("branch r1 belongs to worktree r1");
    expect(f.records().map((r) => r.name)).toEqual(["r1"]);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh refuses a database no worktree records and says how to free the name",
  () => {
    writeFileSync(join(f.state, "dbs", "alliance_b"), "");

    const result = f.create("b");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "database alliance_b already exists and no worktree records it — pick another name, or drop it if nothing uses it",
    );
    expect(f.databases()).toContain("alliance_b");
  },
  TIMEOUT,
);

test(
  "new-worktree.sh refuses the name of a worktree created before records by its directory, not its databases",
  () => {
    fixtureGit(f.main, "worktree", "add", "-q", "-b", "old", f.dir("old"));
    mkdirSync(join(f.dir("old"), ".worktree"));
    writeFileSync(join(f.state, "dbs", "alliance_old"), "");
    writeFileSync(join(f.state, "dbs", "alliance_old_test"), "");

    const result = f.create("old");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`${f.dir("old")} already exists`);
    expect(result.stderr).not.toContain("database alliance_old already exists");
    expect(f.databases()).toContain("alliance_old");
  },
  TIMEOUT,
);

function beforeTestDbCreate(script: string) {
  const stub = join(f.root, "bin", "createdb");
  writeFileSync(
    stub,
    readFileSync(stub, "utf8").replace(
      "\n",
      `\ncase " $* " in *"_test "*) ${script} ;; esac\n`,
    ),
  );
}

test(
  "new-worktree.sh claims no worktree made by hand at its path while it copied databases",
  () => {
    beforeTestDbCreate(
      `git -C "${f.main}" worktree add -q -b mine "${f.dir("foo")}" && echo uncommitted > "${f.dir("foo")}/work.txt"`,
    );
    const failed = f.create("foo");
    expect(failed.exitCode).toBe(1);
    expect(failed.stderr).toContain(`could not create ${f.dir("foo")}`);

    const result = f.remove(["foo"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "does not belong to the recorded worktree foo, so it was kept — move it elsewhere",
    );
    expect(existsSync(join(f.dir("foo"), "work.txt"))).toBe(true);

    const moved = join(f.root, "moved");
    fixtureGit(f.main, "worktree", "move", f.dir("foo"), moved);
    expect(f.remove(["foo"]).exitCode).toBe(0);
    expect(f.records()).toEqual([]);
    expect(existsSync(join(moved, "work.txt"))).toBe(true);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh claims no worktree made by hand where its finished worktree was deleted",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    rmSync(f.dir("a"), { recursive: true });
    fixtureGit(f.main, "worktree", "prune");
    fixtureGit(f.main, "worktree", "add", "-q", "-b", "mine", f.dir("a"));
    writeFileSync(join(f.dir("a"), "work.txt"), "uncommitted");

    const result = f.remove(["a"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "does not belong to the recorded worktree a",
    );
    expect(existsSync(join(f.dir("a"), "work.txt"))).toBe(true);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh claims no worktree re-added by hand with --force at its deleted path",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    rmSync(f.dir("a"), { recursive: true });
    fixtureGit(f.main, "worktree", "add", "-qf", "-b", "mine", f.dir("a"));

    const result = f.remove(["a"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "does not belong to the recorded worktree a",
    );
    expect(f.branchExists("mine")).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh removes a worktree whose ignored files git clean deleted",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    fixtureGit(f.dir("a"), "clean", "-fdxq");

    const result = f.remove(["a"]);

    expect(result.exitCode).toBe(0);
    expect(existsSync(f.dir("a"))).toBe(false);
    expect(f.databases()).not.toContain("alliance_a");
    expect(f.records()).toEqual([]);
  },
  TIMEOUT,
);

test.each([
  ["removes an empty directory", (dir: string) => mkdirSync(dir), true],
  [
    "removes a locked tree holding only its .git",
    (dir: string) =>
      fixtureGit(
        f.main,
        "worktree",
        "add",
        "-q",
        "--no-checkout",
        "--lock",
        "--detach",
        dir,
      ),
    true,
  ],
  [
    "keeps a worktree checked out there by hand",
    (dir: string) =>
      fixtureGit(f.main, "worktree", "add", "-q", "--detach", dir),
    false,
  ],
] as const)(
  "rm-worktree.sh, for a creation stopped before its checkout, %s",
  (_, makeTree, claimed) => {
    writeFileSync(
      join(f.root, "bin", "createdb"),
      `#!/usr/bin/env bash\nfor a in "$@"; do case "$a" in *_test) exit 1 ;; esac; done\n`,
    );
    expect(f.create("foo").exitCode).toBe(1);
    makeTree(f.dir("foo"));
    appendFileSync(f.recordPath("foo"), "dir_added=1\n");

    const result = f.remove(["foo"]);

    expect(result.exitCode).toBe(claimed ? 0 : 1);
    expect(existsSync(f.dir("foo"))).toBe(!claimed);
    expect(existsSync(join(f.main, ".git", "worktrees", "alliance-foo"))).toBe(
      !claimed,
    );
    expect(f.records().length).toBe(claimed ? 0 : 1);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh claims no database made by hand under its name after the check",
  () => {
    beforeTestDbCreate(`printf '' > "$STATE/dbs/alliance_foo_test"`);
    expect(f.create("foo").exitCode).toBe(1);

    const result = f.remove(["foo"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "database alliance_foo_test is not tagged as owned by this worktree (no tag), so it was kept — rename it",
    );
    expect(f.databases()).toEqual(["alliance_foo_test", "fixture_main"]);

    renameSync(
      join(f.state, "dbs", "alliance_foo_test"),
      join(f.state, "dbs", "mine"),
    );
    expect(f.remove(["foo"]).exitCode).toBe(0);
    expect(f.records()).toEqual([]);
    expect(f.databases()).toEqual(["fixture_main", "mine"]);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh removes the database of a creation stopped while copying it",
  async () => {
    f.touch("hold-template");
    const { proc } = f.spawn({ script: "new-worktree.sh", args: ["cut"] });
    await f.reached("hold-template", proc);
    proc.kill("SIGKILL");
    await proc.exited;
    f.release("hold-template");
    expect(f.databases()).toEqual([f.stagingDb("cut"), "fixture_main"]);
    expect(f.dbComment(f.stagingDb("cut"))).toBe("");

    const removal = f.remove(["cut"]);

    expect(removal.exitCode).toBe(0);
    expect(f.gone("cut")).toBe(true);
    expect(f.databases()).toEqual(["fixture_main"]);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh and rm-worktree.sh handle worktrees git links by relative paths",
  () => {
    fixtureGit(f.main, "config", "worktree.useRelativePaths", "true");
    expect(f.create("rel").exitCode).toBe(0);
    expect(readFileSync(join(f.dir("rel"), ".git"), "utf8")).toStartWith(
      "gitdir: ../",
    );
    expect(f.instanceId("rel")).toBe(f.record("rel").id);

    const removal = f.remove(["rel"]);

    expect(removal.exitCode).toBe(0);
    expect(f.gone("rel")).toBe(true);
  },
  TIMEOUT,
);
