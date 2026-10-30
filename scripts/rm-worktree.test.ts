import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
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
  "rm-worktree.sh removes a worktree, discarding every kind of unfinished work",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    expect(f.create("sib").exitCode).toBe(0);
    f.commit(f.dir("a"), "unpublished.txt");
    writeFileSync(join(f.dir("a"), "staged.txt"), "staged");
    fixtureGit(f.dir("a"), "add", "staged.txt");
    writeFileSync(join(f.dir("a"), "unpublished.txt"), "unstaged");
    writeFileSync(join(f.dir("a"), "untracked.txt"), "untracked");
    writeFileSync(join(f.dir("a"), "ignored.txt"), "ignored");

    const result = f.remove(["a"]);

    expect(result.exitCode).toBe(0);
    expect(f.gone("a")).toBe(true);
    expect(f.records().map((r) => r.name)).toEqual(["sib"]);
    expect(f.git(f.main, "worktree", "list")).not.toContain("alliance-a");
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh keeps a branch that existed before its worktree, and never touches the remote",
  () => {
    const remote = join(f.root, "remote.git");
    fixtureGit(f.root, "init", "-q", "--bare", remote);
    fixtureGit(f.main, "branch", "keep");
    fixtureGit(f.main, "remote", "add", "origin", remote);
    fixtureGit(f.main, "push", "-q", "origin", "main", "keep");
    expect(f.create("k", { args: ["--branch", "keep"] }).exitCode).toBe(0);
    f.commit(f.dir("k"), "kept.txt");
    expect(f.create("pushed").exitCode).toBe(0);
    f.commit(f.dir("pushed"), "pushed.txt");
    fixtureGit(f.dir("pushed"), "push", "-q", "origin", "pushed");
    const remoteRefs = f.git(remote, "show-ref");
    const keepHead = f.git(f.main, "rev-parse", "keep");

    const result = f.remove(["k"]);
    expect(f.remove(["pushed"]).exitCode).toBe(0);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "kept branches:\n  keep (existed before k)",
    );
    expect(existsSync(f.dir("k"))).toBe(false);
    expect(f.git(f.main, "rev-parse", "keep")).toBe(keepHead);
    expect(f.branchExists("pushed")).toBe(false);
    expect(f.git(remote, "show-ref")).toBe(remoteRefs);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh reports what a failed removal left, keeps a worktree made by hand in its place, and finishes on rerun",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    expect(f.create("b").exitCode).toBe(0);
    f.touch("fail-drop-alliance_a");
    const trash = `${f.dir("b")}.removing-${f.record("b").id}`;
    mkdirSync(join(f.dir("b"), "stuck"));
    writeFileSync(join(f.dir("b"), "stuck", "file"), "");
    chmodSync(join(f.dir("b"), "stuck"), 0o500);

    const failedDrop = f.remove(["a"]);
    const failedDelete = f.remove(["b"]);

    expect(failedDrop.exitCode).toBe(1);
    expect(failedDrop.stderr).toContain("could not drop database alliance_a");
    expect(failedDelete.exitCode).toBe(1);
    expect(failedDelete.stderr).toContain(`could not delete all of ${trash}`);
    expect(
      f
        .records()
        .map((r) => r.name)
        .sort(),
    ).toEqual(["a", "b"]);

    fixtureGit(f.main, "worktree", "prune");
    fixtureGit(f.main, "worktree", "add", "-q", "-b", "mine", f.dir("b"));
    writeFileSync(join(f.dir("b"), "work.txt"), "uncommitted");
    expect(f.remove(["b"]).stderr).toContain(
      "does not belong to the recorded worktree b",
    );
    expect(existsSync(join(f.dir("b"), "work.txt"))).toBe(true);

    fixtureGit(f.main, "worktree", "remove", "--force", f.dir("b"));
    f.release("fail-drop-alliance_a");
    chmodSync(join(trash, "stuck"), 0o700);

    expect(f.remove(["a"]).exitCode).toBe(0);
    expect(f.remove(["b"]).exitCode).toBe(0);
    expect(existsSync(trash)).toBe(false);
    expect(f.gone("a") && f.gone("b")).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh rejects malformed and foreign ownership without removing anything unrelated",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    expect(f.create("sib").exitCode).toBe(0);
    const recordPath = f.recordPath("a");
    const original = readFileSync(recordPath, "utf8");
    writeFileSync(recordPath, original.replace(/^dir=.*$/m, `dir=${f.main}`));

    const malformed = f.remove(["a"]);
    expect(malformed.exitCode).toBe(1);
    expect(malformed.stderr).toContain("names a directory other than");
    expect(existsSync(f.dir("a"))).toBe(true);
    expect(f.databases().length).toBe(5);

    writeFileSync(recordPath, original);
    writeFileSync(join(f.state, "dbs", "alliance_a"), "someone else");
    const foreign = f.remove(["a"]);
    expect(foreign.exitCode).toBe(1);
    expect(foreign.stderr).toContain(
      "database alliance_a is not tagged as owned by this worktree",
    );
    expect(f.databases()).toContain("alliance_a");
    expect(existsSync(f.dir("a")) && existsSync(f.dir("sib"))).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh rejects a locked target and a removal of the caller's own checkout",
  () => {
    expect(f.create("a").exitCode).toBe(0);

    fixtureGit(f.main, "worktree", "lock", f.dir("a"));
    const locked = f.remove(["a"]);
    expect(locked.exitCode).toBe(1);
    expect(locked.stderr).toContain("is locked");
    fixtureGit(f.main, "worktree", "unlock", f.dir("a"));

    const inside = f.remove(["a"], f.dir("a"));
    expect(inside.exitCode).toBe(1);
    expect(inside.stderr).toContain("the checkout you are working in");

    expect(existsSync(f.dir("a"))).toBe(true);
    expect(f.databases().length).toBe(3);
    expect(f.flaggedForRemoval("a")).toBe(false);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh refuses the main checkout as a removal target",
  () => {
    const home = new WorktreeFixture({ mainDirName: "alliance-home" });
    try {
      const result = home.remove(["home"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("refusing to remove the main checkout");
      expect(existsSync(home.main)).toBe(true);
    } finally {
      home.cleanup();
    }
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh removes a worktree created before records by name, leaving other such worktrees alone",
  () => {
    f.addUnrecorded({ name: "old", slot: 240 });
    f.addUnrecorded({ name: "other", slot: 241 });

    const result = f.remove(["old"]);

    expect(result.exitCode).toBe(0);
    expect(existsSync(f.dir("old"))).toBe(false);
    expect(f.databases()).toEqual([
      "alliance_other",
      "alliance_other_test",
      "fixture_main",
    ]);
    expect(existsSync(f.dir("other"))).toBe(true);
    expect(f.branchExists("other")).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh --list offers every worktree it would remove, except the caller's own",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    writeFileSync(
      join(f.root, "bin", "createdb"),
      `#!/usr/bin/env bash\nexit 1\n`,
    );
    expect(f.create("failed").exitCode).toBe(1);
    f.addUnrecorded({ name: "legacy", slot: 240 });

    expect(f.remove(["--list"]).stdout).toBe(
      "a\ta\nfailed\tfailed\nlegacy\tlegacy\n",
    );
    expect(f.remove(["--list"], f.dir("a")).stdout).toBe(
      "failed\tfailed\nlegacy\tlegacy\n",
    );
    expect(f.remove(["--list"], f.dir("legacy")).stdout).toBe(
      "a\ta\nfailed\tfailed\n",
    );
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh fails when it cannot delete a record",
  () => {
    expect(f.create("q").exitCode).toBe(0);
    chmodSync(f.instances(), 0o555);
    let result;
    try {
      result = f.remove(["q"]);
    } finally {
      chmodSync(f.instances(), 0o755);
    }

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("could not delete the record");
    expect(result.stdout).not.toContain("done");
    expect(f.remove(["q"]).exitCode).toBe(0);
    expect(f.records()).toEqual([]);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh keeps a record it cannot lock the registry to delete",
  async () => {
    expect(f.create("q").exitCode).toBe(0);
    const registryLock = join(dirname(f.instances()), "lock");
    f.touch("hold-drop-alliance_q_test");
    const removal = f.spawn({ script: "rm-worktree.sh", args: ["q"] });
    await f.reached("hold-drop-alliance_q_test", removal.proc);
    rmSync(registryLock);
    mkdirSync(registryLock);
    f.release("hold-drop-alliance_q_test");

    const result = await removal.result;
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "could not lock the worktree registry to delete the record",
    );
    expect(result.stdout).not.toContain("done");
    expect(f.records().map((r) => r.name)).toEqual(["q"]);
    rmSync(registryLock, { recursive: true });
    expect(f.remove(["q"]).exitCode).toBe(0);
    expect(f.records()).toEqual([]);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh keeps another worktree's database at its staging name",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    const other = `wt-${f.stagingDb("a").slice("alliance_wt_".length)}`;
    expect(f.create(other).exitCode).toBe(0);

    const result = f.remove(["a"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      `database ${f.stagingDb("a")} is not tagged as owned by this worktree`,
    );
    expect(f.databases()).toContain(f.stagingDb("a"));
    expect(f.databases()).toContain(`${f.stagingDb("a")}_test`);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh keeps a worktree made by hand where a removal that failed later had already deleted the tree",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    chmodSync(f.instances(), 0o555);
    let failed;
    try {
      failed = f.remove(["a"]);
    } finally {
      chmodSync(f.instances(), 0o755);
    }
    expect(failed.exitCode).toBe(1);
    expect(existsSync(f.dir("a"))).toBe(false);
    fixtureGit(f.main, "worktree", "add", "-q", "-b", "mine", f.dir("a"));
    writeFileSync(join(f.dir("a"), "work.txt"), "uncommitted");

    const rerun = f.remove(["a"]);

    expect(rerun.exitCode).toBe(1);
    expect(rerun.stderr).toContain(
      "does not belong to the recorded worktree a",
    );
    expect(existsSync(join(f.dir("a"), "work.txt"))).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh refuses a worktree whose record is missing",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    rmSync(join(f.instances(), f.record("a").id), { recursive: true });

    const result = f.remove(["a"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("no worktree record matches");
    expect(existsSync(f.dir("a"))).toBe(true);
    expect(f.databases()).toEqual([
      "alliance_a",
      "alliance_a_test",
      "fixture_main",
    ]);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh --list fails when the caller's checkout names another worktree's record",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    expect(f.create("b").exitCode).toBe(0);
    const gitDir = f.git(f.dir("a"), "rev-parse", "--absolute-git-dir");
    writeFileSync(join(gitDir, "alliance-instance"), `${f.instanceId("b")}\n`);

    const listed = f.remove(["--list"], f.dir("a"));

    expect(listed.exitCode).toBe(1);
    expect(listed.stdout).toBe("");
    expect(listed.stderr).toContain("no worktree record for");
  },
  TIMEOUT,
);
