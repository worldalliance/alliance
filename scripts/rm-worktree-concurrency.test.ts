import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { WorktreeFixture } from "./lib/worktree-fixture";

const TIMEOUT = 120_000;

let f: WorktreeFixture;

beforeEach(() => {
  f = new WorktreeFixture();
});

afterEach(() => {
  f.cleanup();
});

function holdRegistry() {
  const lib = join(import.meta.dir, "lib", "worktree-lock.sh");
  const registryLock = join(dirname(f.instances()), "lock");
  return Bun.spawn(
    [
      "bash",
      "-c",
      `source "${lib}"; acquire_lock "${registryLock}" registry 8; touch "${f.state}/held-reached"; until [[ -e "${f.state}/go" ]]; do read -r -t 1 || true; done`,
    ],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  );
}

test(
  "rm-worktree.sh runs overlapping removals, and a name reused while its removal finishes keeps the replacement",
  async () => {
    expect(f.create("a").exitCode).toBe(0);
    expect(f.create("sib").exitCode).toBe(0);

    const both = await Promise.all([
      f.spawn({ script: "rm-worktree.sh", args: ["a"] }).result,
      f.spawn({ script: "rm-worktree.sh", args: ["a"] }).result,
    ]);
    expect(both.map((r) => r.exitCode)).toEqual([0, 0]);
    expect(f.gone("a")).toBe(true);

    f.touch("hold-drop-alliance_sib_test");
    const removal = f.spawn({ script: "rm-worktree.sh", args: ["sib"] });
    await f.reached("hold-drop-alliance_sib_test", removal.proc);
    const replacement = f.spawn({ script: "new-worktree.sh", args: ["sib"] });
    await replacement.stderrContains("to finish removing the previous sib");
    f.release("hold-drop-alliance_sib_test");

    expect((await removal.result).exitCode).toBe(0);
    expect((await replacement.result).exitCode).toBe(0);
    const record = f.record("sib");
    expect(f.instanceId("sib")).toBe(record.id);
    expect(f.dbComment("alliance_sib")).toBe(`alliance-worktree:${record.id}`);
    expect(f.branchExists("sib")).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh exits cleanly when a concurrent run removes the record it found",
  async () => {
    expect(f.create("a").exitCode).toBe(0);
    const holder = holdRegistry();
    await f.reached("held", holder);

    const removal = f.spawn({ script: "rm-worktree.sh", args: ["a"] });
    await removal.stderrContains(
      "waiting for another run to release the worktree registry",
    );
    rmSync(dirname(f.recordPath("a")), { recursive: true });
    f.touch("go");

    const result = await removal.result;
    await holder.exited;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("a was removed by another run");
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh keeps a worktree that reused the name while it waited for the registry",
  async () => {
    expect(f.create("a").exitCode).toBe(0);
    const holder = holdRegistry();
    await f.reached("held", holder);

    const removal = f.spawn({ script: "rm-worktree.sh", args: ["a"] });
    await removal.stderrContains(
      "waiting for another run to release the worktree registry",
    );
    const oldId = f.record("a").id;
    const newId = `${oldId.slice(0, -1)}${oldId.endsWith("0") ? "1" : "0"}`;
    renameSync(join(f.instances(), oldId), join(f.instances(), newId));
    const gitDir = f.git(f.dir("a"), "rev-parse", "--absolute-git-dir");
    writeFileSync(join(gitDir, "alliance-instance"), `${newId}\n`);
    for (const db of ["alliance_a", "alliance_a_test"]) {
      writeFileSync(join(f.state, "dbs", db), `alliance-worktree:${newId}`);
    }
    f.touch("go");

    const result = await removal.result;
    await holder.exited;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("a was removed by another run");
    expect(f.record("a").id).toBe(newId);
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
  "rm-worktree.sh keeps a worktree recorded while it waited for the registry",
  async () => {
    expect(f.create("a").exitCode).toBe(0);
    const recordDir = dirname(f.recordPath("a"));
    const aside = join(f.state, "record-aside");
    renameSync(recordDir, aside);
    const holder = holdRegistry();
    await f.reached("held", holder);

    const removal = f.spawn({ script: "rm-worktree.sh", args: ["a"] });
    await removal.stderrContains(
      "waiting for another run to release the worktree registry",
    );
    renameSync(aside, recordDir);
    f.touch("go");

    const result = await removal.result;
    await holder.exited;
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(
      "a was recorded by a creation that started after this run, so it was kept",
    );
    expect(existsSync(f.dir("a"))).toBe(true);
    expect(f.databases()).toEqual([
      "alliance_a",
      "alliance_a_test",
      "fixture_main",
    ]);
    expect(f.branchExists("a")).toBe(true);
  },
  TIMEOUT,
);
