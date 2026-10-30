import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
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
  "rm-worktree.sh <child> removes that child and its own child, keeping its parent and siblings",
  () => {
    f.createTree();

    const result = f.remove(["b"]);

    expect(result.exitCode).toBe(0);
    expect(f.gone("b") && f.gone("c")).toBe(true);
    expect(
      f
        .records()
        .map((r) => r.name)
        .sort(),
    ).toEqual(["a", "sib"]);
    expect(existsSync(f.dir("a")) && existsSync(f.dir("sib"))).toBe(true);
    expect(f.branchExists("a")).toBe(true);
    expect(f.databases()).toContain("alliance_a");
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh <name> removes descendants, then the parent, discarding every kind of unfinished work",
  () => {
    f.createTree();
    f.commit(f.dir("b"), "unpublished.txt");
    writeFileSync(join(f.dir("b"), "staged.txt"), "staged");
    fixtureGit(f.dir("b"), "add", "staged.txt");
    writeFileSync(join(f.dir("b"), "unpublished.txt"), "unstaged");
    writeFileSync(join(f.dir("b"), "untracked.txt"), "untracked");
    writeFileSync(join(f.dir("b"), "ignored.txt"), "ignored");

    const result = f.remove(["a"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.indexOf("removed c")).toBeLessThan(
      result.stdout.indexOf("removed b"),
    );
    expect(result.stdout.indexOf("removed b")).toBeLessThan(
      result.stdout.indexOf("removed a"),
    );
    expect(f.gone("a") && f.gone("b") && f.gone("c")).toBe(true);
    expect(f.records().map((r) => r.name)).toEqual(["sib"]);
    expect(f.git(f.main, "worktree", "list")).not.toContain("alliance-b");
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh reports what a failed removal left, keeps its ancestors, removes independent siblings, and finishes on rerun",
  () => {
    f.createTree();
    expect(f.create("b2", { cwd: f.dir("a") }).exitCode).toBe(0);
    expect(f.create("b3", { cwd: f.dir("a") }).exitCode).toBe(0);
    f.touch("fail-drop-alliance_c");
    const trash = `${f.dir("b2")}.removing-${f.record("b2").id}`;
    mkdirSync(join(f.dir("b2"), "stuck"));
    writeFileSync(join(f.dir("b2"), "stuck", "file"), "");
    chmodSync(join(f.dir("b2"), "stuck"), 0o500);

    const failed = f.remove(["a"]);

    expect(failed.exitCode).toBe(1);
    expect(failed.stderr).toContain("could not drop database alliance_c");
    expect(failed.stderr).toContain(`could not delete all of ${trash}`);
    expect(failed.stderr).toContain("b was kept because a descendant remains");
    expect(failed.stderr).toContain("a was kept because a descendant remains");
    expect(
      f
        .records()
        .map((r) => r.name)
        .sort(),
    ).toEqual(["a", "b", "b2", "c", "sib"]);
    expect(f.gone("b3")).toBe(true);
    expect(existsSync(f.dir("a"))).toBe(true);

    f.release("fail-drop-alliance_c");
    chmodSync(join(trash, "stuck"), 0o700);
    const rerun = f.remove(["a"]);

    expect(rerun.exitCode).toBe(0);
    expect(["a", "b", "b2", "c"].every((name) => f.gone(name))).toBe(true);
    expect(f.records().map((r) => r.name)).toEqual(["sib"]);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh runs an ancestor's and a descendant's removals concurrently",
  async () => {
    f.createTree();

    const [outer, inner] = await Promise.all([
      f.spawn({ script: "rm-worktree.sh", args: ["a"] }).result,
      f.spawn({ script: "rm-worktree.sh", args: ["b"] }).result,
    ]);
    expect(outer.exitCode).toBe(0);
    expect(inner.exitCode, inner.stderr).toBe(0);
    expect(["a", "b", "c"].every((name) => f.gone(name))).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh rejects malformed and foreign ownership without removing anything unrelated",
  () => {
    f.createTree();
    const recordPath = f.recordPath("c");
    const original = readFileSync(recordPath, "utf8");
    writeFileSync(recordPath, original.replace(/^dir=.*$/m, `dir=${f.main}`));

    const malformed = f.remove(["a"]);
    expect(malformed.exitCode).toBe(1);
    expect(malformed.stderr).toContain("names a directory other than");
    expect(["a", "b", "c"].every((name) => existsSync(f.dir(name)))).toBe(true);
    expect(f.databases().length).toBe(9);

    writeFileSync(recordPath, original);
    writeFileSync(join(f.state, "dbs", "alliance_b"), "someone else");
    const foreign = f.remove(["a"]);
    expect(foreign.exitCode).toBe(1);
    expect(foreign.stderr).toContain(
      "database alliance_b is not tagged as owned by this worktree",
    );
    expect(f.databases()).toContain("alliance_b");
    expect(existsSync(f.dir("b")) && existsSync(f.dir("a"))).toBe(true);
    expect(f.gone("c")).toBe(true);
    expect(existsSync(f.dir("sib"))).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh rejects a record without a readable parent, a locked target, and a removal that includes the caller",
  () => {
    f.createTree();
    const before = f.records();
    const stray = join(f.instances(), "01a00000-0000-7000-8000-000000000000");
    mkdirSync(stray);
    writeFileSync(join(stray, "record"), "name=stray\n");

    expect(f.remove(["sib"]).stderr).toContain("has no valid id and parent");
    expect(f.records().length).toBe(before.length + 1);
    writeFileSync(join(stray, "record"), "name=stray\nparent=main\n");

    fixtureGit(f.main, "worktree", "lock", f.dir("c"));
    const locked = f.remove(["a"]);
    expect(locked.exitCode).toBe(1);
    expect(locked.stderr).toContain("is locked");
    fixtureGit(f.main, "worktree", "unlock", f.dir("c"));

    const inside = f.remove(["a"], f.dir("b"));
    expect(inside.exitCode).toBe(1);
    expect(inside.stderr).toContain("the checkout you are working in");

    expect(
      ["a", "b", "c", "sib"].every((name) => existsSync(f.dir(name))),
    ).toBe(true);
    expect(f.databases().length).toBe(9);
    expect(["a", "b", "c"].some((name) => f.flaggedForRemoval(name))).toBe(
      false,
    );
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh fails on a parent loop instead of hanging with the registry lock held",
  () => {
    f.createTree();
    const recordPath = f.recordPath("a");
    const record = readFileSync(recordPath, "utf8");
    writeFileSync(
      recordPath,
      record.replace(/^parent=.*$/m, `parent=${f.record("c").id}`),
    );

    const result = f.remove(["b"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("form a parent loop");
    const listed = f.remove(["--list"], f.dir("b"));
    expect(listed.exitCode).toBe(1);
    expect(listed.stderr).toContain("form a parent loop");
    expect(f.create("after").exitCode).toBe(0);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh --list leaves out the current checkout and its ancestors",
  () => {
    f.createTree();

    const listed = f
      .run({ script: "rm-worktree.sh", args: ["--list"], cwd: f.dir("b") })
      .stdout.split("\n")
      .filter(Boolean)
      .map((line) => line.split("\t")[0])
      .sort();

    expect(listed).toEqual(["c", "sib"]);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh refuses a removal that includes the checkout holding the running script, even reached through a symlink",
  () => {
    f.createTree();
    const link = join(f.root, "link-c");
    symlinkSync(f.dir("c"), link);

    for (const checkout of [f.dir("c"), link]) {
      for (const cwd of [f.root, f.main, f.dir("sib")]) {
        const result = f.run({
          script: "rm-worktree.sh",
          args: ["a"],
          cwd,
          checkout,
        });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("holds the rm-worktree.sh running now");
      }
    }
    const listed = f.run({
      script: "rm-worktree.sh",
      args: ["--list"],
      cwd: f.main,
      checkout: f.dir("c"),
    }).stdout;
    expect(listed).not.toMatch(/^(a|b|c)\t/m);
    expect(["a", "b", "c"].every((name) => existsSync(f.dir(name)))).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh refuses a name two records claim, flagging neither",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    const copy = join(f.instances(), "01900000-0000-7000-8000-000000000000");
    cpSync(join(f.instances(), f.record("a").id), copy, { recursive: true });

    const result = f.remove(["a"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("more than one worktree record");
    expect(existsSync(f.dir("a"))).toBe(true);
    expect(f.records().length).toBe(2);
    expect(existsSync(join(copy, "removing"))).toBe(false);
    expect(f.flaggedForRemoval("a")).toBe(false);
  },
  TIMEOUT,
);
