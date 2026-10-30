import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  appendFileSync,
  existsSync,
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
  "new-worktree.sh records each creator as parent, starts at its commit, and copies config from the main checkout",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    f.commit(f.dir("a"), "a.txt");
    appendFileSync(join(f.dir("a"), "server", ".env"), "EDITED_IN=a\n");

    expect(f.create("b", { cwd: f.dir("a") }).exitCode).toBe(0);
    f.commit(f.dir("b"), "b.txt");
    expect(f.create("c", { cwd: f.dir("b") }).exitCode).toBe(0);

    const initial = f.git(f.main, "rev-parse", "HEAD");
    expect(
      f.create("d", { cwd: f.dir("a"), args: ["--from", initial] }).exitCode,
    ).toBe(0);

    expect(f.record("a").parent).toBe("main");
    expect(f.record("b").parent).toBe(f.record("a").id);
    expect(f.record("c").parent).toBe(f.record("b").id);
    expect(f.record("d").parent).toBe(f.record("a").id);
    expect(f.record("b").branch_from).toBe(
      f.git(f.dir("a"), "rev-parse", "HEAD"),
    );

    expect(f.git(f.dir("b"), "rev-parse", "HEAD~1")).toBe(
      f.git(f.dir("a"), "rev-parse", "HEAD"),
    );
    expect(f.git(f.dir("c"), "rev-parse", "HEAD")).toBe(
      f.git(f.dir("b"), "rev-parse", "HEAD"),
    );
    expect(f.git(f.dir("d"), "rev-parse", "HEAD")).toBe(initial);

    const names = ["a", "b", "c", "d"];
    expect(new Set(names.map((n) => f.record(n).slot)).size).toBe(4);
    for (const name of names) {
      const env = readFileSync(join(f.dir(name), "server", ".env"), "utf8");
      expect(env).toContain("SOURCE=main");
      expect(env).toContain(`DB_NAME=alliance_${name}`);
      if (name !== "a") expect(env).not.toContain("EDITED_IN=a");
      const tag = `alliance-worktree:${f.record(name).id}`;
      expect(f.dbComment(`alliance_${name}`)).toBe(tag);
      expect(f.dbComment(`alliance_${name}_test`)).toBe(tag);
      expect(f.instanceId(name)).toBe(f.record(name).id);
    }
  },
  TIMEOUT,
);

test(
  "new-worktree.sh refuses to run in a worktree created before parent tracking",
  () => {
    fixtureGit(f.main, "worktree", "add", "-q", f.dir("old"), "-b", "old");

    const result = f.create("child", { cwd: f.dir("old") });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("has no worktree record");
    expect(f.records()).toEqual([]);
    expect(f.databases()).toEqual(["fixture_main"]);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh refuses a child for a parent being removed, and removal waits for a child already being created",
  async () => {
    expect(f.create("p").exitCode).toBe(0);

    f.touch("hold-install");
    const child = f.spawn({
      script: "new-worktree.sh",
      args: ["kid"],
      cwd: f.dir("p"),
    });
    await f.reached("hold-install", child.proc);

    f.touch("hold-drop-alliance_p");
    const removal = f.spawn({ script: "rm-worktree.sh", args: ["p"] });
    await removal.stderrContains(
      "waiting for another run to release worktree kid",
    );
    expect(existsSync(f.dir("kid"))).toBe(true);
    expect(f.records().map((r) => r.name)).toContain("kid");
    f.release("hold-install");
    expect((await child.result).exitCode).toBe(0);

    await f.reached("hold-drop-alliance_p", removal.proc);
    const late = f.create("late", { cwd: f.dir("p") });
    f.release("hold-drop-alliance_p");

    expect(late.exitCode).toBe(1);
    expect(late.stderr).toContain("is being removed");
    const removed = await removal.result;
    expect(removed.exitCode).toBe(0);
    expect(removed.stderr).toContain(
      "waiting for another run to release worktree kid",
    );
    expect(f.records()).toEqual([]);
    expect(f.databases()).toEqual(["fixture_main"]);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh refuses a child for a parent whose removal stopped, naming the command that finishes it",
  () => {
    expect(f.create("p").exitCode).toBe(0);
    f.touch("fail-drop-alliance_p");
    expect(f.remove(["p"]).exitCode).toBe(1);

    const refused = f.create("kid", { cwd: f.dir("p") });

    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain(
      "an earlier removal that includes " + f.dir("p") + " did not finish",
    );
    expect(refused.stderr).toContain("'scripts/rm-worktree.sh p' finishes it");
    f.release("fail-drop-alliance_p");
    expect(f.remove(["p"]).exitCode).toBe(0);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh names the ancestor whose stopped removal flagged its parent",
  () => {
    f.createTree();
    f.touch("fail-drop-alliance_c");
    expect(f.remove(["a"]).exitCode).toBe(1);
    f.release("fail-drop-alliance_c");
    expect(f.remove(["c"]).exitCode).toBe(0);

    const refused = f.create("kid", { cwd: f.dir("b") });

    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain("'scripts/rm-worktree.sh a' finishes it");

    const recordPath = f.recordPath("a");
    const record = readFileSync(recordPath, "utf8");
    writeFileSync(
      recordPath,
      record.replace(/^parent=.*$/m, `parent=${f.record("b").id}`),
    );
    const looped = f.create("kid", { cwd: f.dir("b") });
    expect(looped.stderr).toContain("form a parent loop");
    expect(looped.stderr).not.toContain("finishes it");
    writeFileSync(recordPath, record);
    expect(f.remove(["a"]).exitCode).toBe(0);
    expect(f.records().map((r) => r.name)).toEqual(["sib"]);
  },
  TIMEOUT,
);

test(
  "the working directory, not the script's checkout, picks the checkout a command acts for",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    f.commit(f.dir("a"), "a.txt");

    const created = f.run({
      script: "new-worktree.sh",
      args: ["b"],
      cwd: f.dir("a"),
      checkout: f.main,
    });

    expect(created.exitCode).toBe(0);
    expect(f.record("b").parent).toBe(f.record("a").id);
    expect(f.git(f.dir("b"), "rev-parse", "HEAD")).toBe(
      f.git(f.dir("a"), "rev-parse", "HEAD"),
    );
    expect(
      f.run({
        script: "rm-worktree.sh",
        args: ["--list"],
        cwd: f.dir("b"),
        checkout: f.main,
      }).stdout,
    ).toBe("");
  },
  TIMEOUT,
);

test(
  "new-worktree.sh records the parent whose scripts run, even reached through a symlink from outside the repository",
  () => {
    expect(f.create("a").exitCode).toBe(0);
    const link = join(f.root, "link-a");
    symlinkSync(f.dir("a"), link);

    const result = f.run({
      script: "new-worktree.sh",
      args: ["b"],
      cwd: f.root,
      checkout: link,
    });

    expect(result.exitCode).toBe(0);
    expect(f.record("b").parent).toBe(f.record("a").id);
  },
  TIMEOUT,
);
