import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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
  "rm-worktree.sh keeps a same-named branch that a failed creation never made",
  () => {
    writeFileSync(
      join(f.root, "bin", "createdb"),
      `#!/usr/bin/env bash\nfor a in "$@"; do case "$a" in *_test) exit 1 ;; esac; done\n`,
    );
    expect(f.create("foo").exitCode).toBe(1);
    fixtureGit(f.main, "checkout", "-q", "-b", "foo");
    f.commit(f.main, "precious.txt");
    fixtureGit(f.main, "checkout", "-q", "main");
    const tip = f.git(f.main, "rev-parse", "foo");

    const result = f.remove(["foo"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("kept branches:\n  foo (not made by foo)");
    expect(f.git(f.main, "rev-parse", "foo")).toBe(tip);
    expect(f.records()).toEqual([]);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh keeps a branch someone else made while a creation copied its database",
  async () => {
    f.touch("hold-template");
    const creation = f.spawn({ script: "new-worktree.sh", args: ["foo"] });
    await f.reached("hold-template", creation.proc);
    fixtureGit(f.main, "branch", "foo");
    const tip = f.git(f.main, "rev-parse", "foo");
    f.release("hold-template");
    expect((await creation.result).exitCode).not.toBe(0);

    const result = f.remove(["foo"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("kept branches:\n  foo (not made by foo)");
    expect(f.git(f.main, "rev-parse", "foo")).toBe(tip);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh keeps a checked-out branch at the commit a killed creation recorded",
  () => {
    writeFileSync(
      join(f.root, "bin", "git"),
      `#!/usr/bin/env bash\n[[ "$3" == branch && "$4" != -* ]] && { kill -9 $PPID; exit 1; }\nexec "${Bun.which("git")}" "$@"\n`,
    );
    chmodSync(join(f.root, "bin", "git"), 0o755);
    expect(f.create("foo").exitCode).not.toBe(0);
    rmSync(join(f.root, "bin", "git"));
    const from = f.git(f.main, "rev-parse", "HEAD");
    expect(f.record("foo").branch_from).toBe(from);
    expect(f.branchExists("foo")).toBe(false);
    fixtureGit(f.main, "checkout", "-q", "-b", "foo");

    const result = f.remove(["foo"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "kept branches:\n  foo (checked out in another worktree)",
    );
    expect(f.git(f.main, "rev-parse", "HEAD")).toBe(from);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh deletes a branch a killed creation made but never recorded, unless it has moved",
  () => {
    writeFileSync(
      join(f.root, "bin", "git"),
      `#!/usr/bin/env bash\n"${Bun.which("git")}" "$@" || exit\n[[ "$3" == branch && "$4" != -* ]] && kill -9 $PPID\nexit 0\n`,
    );
    chmodSync(join(f.root, "bin", "git"), 0o755);
    expect(f.create("foo").exitCode).not.toBe(0);
    expect(f.create("bar").exitCode).not.toBe(0);
    rmSync(join(f.root, "bin", "git"));
    expect(f.record("foo").branch_added).toBeUndefined();
    expect(f.branchExists("foo")).toBe(true);
    fixtureGit(f.main, "checkout", "-q", "bar");
    f.commit(f.main, "precious.txt");
    fixtureGit(f.main, "checkout", "-q", "main");
    const tip = f.git(f.main, "rev-parse", "bar");

    expect(f.remove(["foo"]).exitCode).toBe(0);
    const kept = f.remove(["bar"]);

    expect(f.gone("foo")).toBe(true);
    expect(kept.exitCode).toBe(0);
    expect(kept.stdout).toContain(
      "kept branches:\n  bar (moved since bar may have made it)",
    );
    expect(f.git(f.main, "rev-parse", "bar")).toBe(tip);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh deletes the branch of a creation that stopped during checkout",
  () => {
    const hook = join(f.main, ".git", "hooks", "post-checkout");
    writeFileSync(hook, "#!/bin/sh\nexit 1\n");
    chmodSync(hook, 0o755);
    expect(f.create("stopped").exitCode).toBe(1);
    expect(f.branchExists("stopped")).toBe(true);
    writeFileSync(hook, "#!/bin/sh\nexit 0\n");
    expect(f.remove(["--list"]).stdout).toBe("stopped\tstopped\n");

    const result = f.remove(["stopped"]);

    expect(result.exitCode).toBe(0);
    expect(f.gone("stopped")).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh removes a creation killed with its git mid-checkout",
  () => {
    const smudge = join(f.state, "kill-creation");
    writeFileSync(
      smudge,
      `#!/bin/sh
p=$PPID chain=
while [ "$p" -gt 1 ]; do
  chain="$p $chain"
  case "$(ps -o command= -p "$p")" in *new-worktree.sh*) break ;; esac
  p=$(ps -o ppid= -p "$p" | tr -d ' ')
done
kill -9 $chain
`,
    );
    chmodSync(smudge, 0o755);
    writeFileSync(join(f.main, ".gitattributes"), "* filter=kill\n");
    fixtureGit(f.main, "add", ".gitattributes");
    fixtureGit(f.main, "commit", "-qm", "filter");
    fixtureGit(f.main, "config", "filter.kill.smudge", smudge);
    expect(f.create("cut").exitCode).not.toBe(0);
    expect(f.instanceId("cut")).toBe(f.record("cut").id);
    fixtureGit(f.main, "config", "--unset", "filter.kill.smudge");

    const result = f.remove(["cut"]);

    expect(result.exitCode).toBe(0);
    expect(f.gone("cut")).toBe(true);
    expect(f.create("cut").exitCode).toBe(0);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh drops a database a failed creation made but never tagged",
  () => {
    f.touch("fail-comment");
    expect(f.create("half").exitCode).toBe(1);
    expect(f.dbComment(f.stagingDb("half"))).toBe("");
    f.release("fail-comment");

    const result = f.remove(["half"]);

    expect(result.exitCode).toBe(0);
    expect(f.databases()).toEqual(["fixture_main"]);
    expect(f.records()).toEqual([]);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh removes the empty directory of a creation stopped before claiming it",
  () => {
    writeFileSync(
      join(f.root, "bin", "createdb"),
      `#!/usr/bin/env bash\nexit 1\n`,
    );
    expect(f.create("foo").exitCode).toBe(1);
    mkdirSync(f.dir("foo"));

    const result = f.remove(["foo"]);

    expect(result.exitCode).toBe(0);
    expect(existsSync(f.dir("foo"))).toBe(false);
    expect(f.records()).toEqual([]);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh keeps a worktree made by hand where a failed creation never checked out",
  () => {
    writeFileSync(
      join(f.root, "bin", "createdb"),
      `#!/usr/bin/env bash\nfor a in "$@"; do case "$a" in *_test) exit 1 ;; esac; done\n`,
    );
    expect(f.create("foo").exitCode).toBe(1);
    fixtureGit(f.main, "worktree", "add", "-q", "-b", "mine", f.dir("foo"));
    writeFileSync(join(f.dir("foo"), "work.txt"), "uncommitted");

    const result = f.remove(["foo"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "does not belong to the recorded worktree foo",
    );
    expect(existsSync(join(f.dir("foo"), "work.txt"))).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh keeps a worktree made by hand where a creation's checkout failed before making the tree",
  () => {
    chmodSync(f.root, 0o555);
    let failed;
    try {
      failed = f.create("foo");
    } finally {
      chmodSync(f.root, 0o755);
    }
    expect(failed.exitCode).toBe(1);
    expect(f.record("foo").dir_added ?? "").toBe("");
    fixtureGit(f.main, "worktree", "add", "-q", "-b", "mine", f.dir("foo"));
    writeFileSync(join(f.dir("foo"), "work.txt"), "uncommitted");

    const result = f.remove(["foo"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "does not belong to the recorded worktree foo",
    );
    expect(existsSync(join(f.dir("foo"), "work.txt"))).toBe(true);
  },
  TIMEOUT,
);

test(
  "rm-worktree.sh still owns a tree claimed only by its creation after failing to move it aside",
  () => {
    expect(f.create("foo").exitCode).toBe(0);
    const gitDir = f.git(f.dir("foo"), "rev-parse", "--absolute-git-dir");
    rmSync(join(gitDir, "alliance-instance"));
    for (const entry of readdirSync(f.dir("foo"))) {
      if (entry !== ".git")
        rmSync(join(f.dir("foo"), entry), { recursive: true });
    }
    const record = readFileSync(f.recordPath("foo"), "utf8");
    writeFileSync(
      f.recordPath("foo"),
      record.replace(/^dir_added=.*$/m, "dir_added=1"),
    );

    chmodSync(f.root, 0o555);
    let failed;
    try {
      failed = f.remove(["foo"]);
    } finally {
      chmodSync(f.root, 0o755);
    }
    expect(failed.exitCode).toBe(1);
    expect(failed.stderr).toContain("could not move");

    const result = f.remove(["foo"]);

    expect(result.exitCode).toBe(0);
    expect(f.gone("foo")).toBe(true);
  },
  TIMEOUT,
);
