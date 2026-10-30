import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
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
  "new-worktree.sh runs simultaneous creations into distinct resources",
  async () => {
    const runs = ["x", "y", "z"].map(
      (name) => f.spawn({ script: "new-worktree.sh", args: [name] }).result,
    );
    const results = await Promise.all(runs);

    expect(results.map((r) => r.exitCode)).toEqual([0, 0, 0]);
    expect(new Set(f.records().map((r) => r.slot)).size).toBe(3);
    expect(f.databases()).toEqual([
      "alliance_x",
      "alliance_x_test",
      "alliance_y",
      "alliance_y_test",
      "alliance_z",
      "alliance_z_test",
      "fixture_main",
    ]);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh lets one of two simultaneous creations take a name, leaving the winner intact",
  async () => {
    const sameName = await Promise.all(
      [0, 1].map(
        () => f.spawn({ script: "new-worktree.sh", args: ["dup"] }).result,
      ),
    );
    expect(sameName.map((r) => r.exitCode).sort()).toEqual([0, 1]);

    expect(f.records().map((r) => r.name)).toEqual(["dup"]);
    expect(f.dbComment("alliance_dup")).toBe(
      `alliance-worktree:${f.record("dup").id}`,
    );
    expect(f.git(f.dir("dup"), "rev-parse", "--abbrev-ref", "HEAD")).toBe(
      "dup",
    );
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh waits for a creation in progress before removing it",
  async () => {
    f.touch("hold-install");
    const creation = f.spawn({ script: "new-worktree.sh", args: ["kid"] });
    await f.reached("hold-install", creation.proc);

    const removal = f.spawn({ script: "rm-worktree.sh", args: ["kid"] });
    await removal.stderrContains(
      "waiting for another run to release worktree kid",
    );
    expect(existsSync(f.dir("kid"))).toBe(true);
    expect(f.records().map((r) => r.name)).toEqual(["kid"]);
    f.release("hold-install");

    expect((await creation.result).exitCode).toBe(0);
    const removed = await removal.result;
    expect(removed.exitCode).toBe(0);
    expect(removed.stderr).toContain(
      "waiting for another run to release worktree kid",
    );
    expect(f.gone("kid")).toBe(true);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh refuses a name whose earlier removal fails while it waits",
  async () => {
    expect(f.create("sib").exitCode).toBe(0);
    const original = readFileSync(f.recordPath("sib"), "utf8");
    f.touch("hold-drop-alliance_sib_test");
    f.touch("fail-drop-alliance_sib_test");
    const removal = f.spawn({ script: "rm-worktree.sh", args: ["sib"] });
    await f.reached("hold-drop-alliance_sib_test", removal.proc);
    const replacement = f.spawn({ script: "new-worktree.sh", args: ["sib"] });
    await replacement.stderrContains("to finish removing the previous sib");
    f.release("hold-drop-alliance_sib_test");

    expect((await removal.result).exitCode).toBe(1);
    const result = await replacement.result;
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("a worktree named sib is already recorded");
    expect(f.records().length).toBe(1);
    expect(readFileSync(f.recordPath("sib"), "utf8")).toBe(original);
  },
  TIMEOUT,
);

test(
  "new-worktree.sh records the commit it branches from when --from moves during the database copy",
  async () => {
    f.touch("hold-template");
    const creation = f.spawn({ script: "new-worktree.sh", args: ["foo"] });
    await f.reached("hold-template", creation.proc);
    f.commit(f.main, "moved.txt");
    f.release("hold-template");

    expect((await creation.result).exitCode).toBe(0);
    expect(f.record("foo").branch_from).toBe(f.git(f.main, "rev-parse", "foo"));
  },
  TIMEOUT,
);
