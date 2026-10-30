import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fixtureGit } from "./fixture-git";

const LIB = join(import.meta.dir, "worktree-paths.sh");

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "worktree-paths-")));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test("a worktree reached through a symlink is still the current checkout", () => {
  const main = join(root, "real", "alliance");
  fixtureGit(root, "init", "-q", "-b", "main", main);
  fixtureGit(main, "commit", "-q", "--allow-empty", "-m", "init");
  fixtureGit(
    main,
    "worktree",
    "add",
    "-q",
    "-b",
    "foo",
    join(root, "real", "alliance-foo"),
  );
  symlinkSync(join(root, "real"), join(root, "link"));

  const result = spawnSync(
    "bash",
    [
      "-c",
      `cd "${join(root, "link", "alliance-foo")}"; repo_root="${join(root, "link", "alliance")}"; source "${LIB}"; is_current_checkout "$(worktree_dir_for foo)"`,
    ],
    { encoding: "utf8" },
  );

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});

test("a working directory deleted out from under the caller fails loudly", () => {
  const gone = join(root, "gone");
  mkdirSync(gone);

  const result = spawnSync(
    "bash",
    [
      "-c",
      `cd "${gone}"; rmdir "${gone}"; repo_root="${import.meta.dir}/../.."; source "${LIB}"; is_current_checkout "${root}"; echo "returned $?"`,
    ],
    { encoding: "utf8" },
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("cannot resolve the current directory");
  expect(result.stdout).not.toContain("returned");
});

test("a checkout git cannot read fails naming that checkout", () => {
  const result = spawnSync(
    "bash",
    [
      "-c",
      `set -euo pipefail; repo_root="${root}"; source "${LIB}"; echo "sourced"`,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(root) },
    },
  );

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(`cannot find the Git directory of ${root}`);
  expect(result.stdout).not.toContain("sourced");
});
