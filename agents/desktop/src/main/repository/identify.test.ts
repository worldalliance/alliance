import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { UpdateBlockerKind } from "../../shared/repository";
import { gitAt } from "./git";
import { FolderProblemKind, fetchTarget, identify } from "./identify";
import type { RepositorySource } from "./source";
import { commitFile, git, makeSource } from "./testing/fixture";

let dir: string;
let source: RepositorySource;
const gitCli = gitAt({ executable: "git", env: process.env });

beforeEach(() => {
  dir = realpathSync(mkdtempSync(path.join(tmpdir(), "identify-")));
  source = makeSource({
    folder: path.join(dir, "source"),
    defaultFolder: path.join(dir, "default"),
  });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const check = (folder: string) => identify({ git: gitCli, source, folder });

const cloneSource = (name = "copy") => {
  const copy = path.join(dir, name);
  git(dir, "clone", "-q", source.url, copy);
  return copy;
};

describe("identify", () => {
  test("checks the folder, whatever GIT_DIR the app inherited", async () => {
    const copy = cloneSource();
    const inherited = gitAt({
      executable: "git",
      env: { ...process.env, GIT_DIR: path.join(source.url, ".git") },
    });
    const found = await identify({ git: inherited, source, folder: copy });
    expect(found.ok && found.value.folder).toBe(copy);
  });

  test("a current copy on main is ready", async () => {
    const copy = cloneSource();
    expect(await check(copy)).toEqual({
      ok: true,
      value: { folder: copy, topLevel: copy },
    });
  });

  test("a worktree or a folder inside a copy resolves to its main checkout", async () => {
    const copy = cloneSource();
    const worktree = path.join(dir, "alliance-task");
    git(copy, "worktree", "add", "-q", worktree);
    mkdirSync(path.join(copy, "inner"));
    expect(await check(worktree)).toEqual({
      ok: true,
      value: { folder: copy, topLevel: worktree },
    });
    expect(await check(path.join(copy, "inner"))).toEqual({
      ok: true,
      value: { folder: copy, topLevel: copy },
    });
  });

  test("tells a missing folder, a plain folder, another repository and a shallow copy apart", async () => {
    const missing = await check(path.join(dir, "nowhere"));
    expect(!missing.ok && missing.error.kind).toBe(FolderProblemKind.Missing);

    const plain = path.join(dir, "plain");
    mkdirSync(plain);
    const notRepository = await check(plain);
    expect(!notRepository.ok && notRepository.error.kind).toBe(
      FolderProblemKind.NotRepository,
    );

    const other = path.join(dir, "other");
    mkdirSync(other);
    git(other, "init", "-q", "-b", "main");
    commitFile({ folder: other, file: "a.txt", message: "Other" });
    const otherRepository = await check(other);
    expect(!otherRepository.ok && otherRepository.error.kind).toBe(
      FolderProblemKind.OtherRepository,
    );

    const shallow = path.join(dir, "shallow");
    git(dir, "clone", "-q", "--depth", "1", `file://${source.url}`, shallow);
    const incomplete = await check(shallow);
    expect(!incomplete.ok && incomplete.error.kind).toBe(
      FolderProblemKind.Incomplete,
    );
  });

  test("a copy without the minimum commit is outdated, and says what blocks updating it", async () => {
    const copy = cloneSource();
    git(copy, "reset", "-q", "--hard", source.firstCommit);
    expect(await check(copy)).toEqual({
      ok: true,
      value: { folder: copy, topLevel: copy, outdated: { blocker: undefined } },
    });

    writeFileSync(path.join(copy, "README.md"), "Changed\n");
    const uncommitted = await check(copy);
    expect(uncommitted.ok && uncommitted.value.outdated?.blocker).toEqual({
      kind: UpdateBlockerKind.Uncommitted,
    });
    git(copy, "checkout", "-q", "README.md");

    git(copy, "checkout", "-q", "-b", "feature");
    const onBranch = await check(copy);
    expect(onBranch.ok && onBranch.value.outdated?.blocker).toEqual({
      kind: UpdateBlockerKind.OnBranch,
      branch: "feature",
    });

    git(copy, "checkout", "-q", "--detach");
    const detached = await check(copy);
    expect(detached.ok && detached.value.outdated?.blocker).toEqual({
      kind: UpdateBlockerKind.Detached,
    });
  });

  test("a copy that has never fetched the minimum commit is outdated", async () => {
    const copy = path.join(dir, "old");
    git(dir, "clone", "-q", "--no-local", source.url, copy);
    git(copy, "reset", "-q", "--hard", source.firstCommit);
    git(copy, "reflog", "expire", "--expire=now", "--all");
    git(copy, "update-ref", "-d", "refs/remotes/origin/main");
    git(copy, "gc", "-q", "--prune=now");
    const old = await check(copy);
    expect(old.ok && old.value.outdated).toEqual({ blocker: undefined });
  });
});

describe("fetchTarget", () => {
  const github = "https://github.com/worldalliance/alliance.git";
  const target = (remotes: Record<string, string>) => {
    const copy = mkdtempSync(path.join(dir, "remotes-"));
    git(copy, "init", "-q");
    for (const [name, url] of Object.entries(remotes))
      git(copy, "remote", "add", name, url);
    return fetchTarget({ git: gitCli, folder: copy, url: github });
  };

  test("names the remote whose URL is the source's, in any of git's forms", async () => {
    for (const url of [
      github,
      "https://github.com/WorldAlliance/alliance",
      "git@github.com:worldalliance/alliance.git",
      "ssh://git@github.com/worldalliance/alliance/",
    ])
      expect(
        await target({
          fork: "git@github.com:someone/alliance.git",
          "up.stream": url,
        }),
      ).toEqual({
        ok: true,
        value: "up.stream",
      });
  });

  test("falls back to the URL when every remote is another repository", async () => {
    expect(
      await target({ origin: "git@github.com:someone/alliance.git" }),
    ).toEqual({ ok: true, value: github });
    expect(await target({})).toEqual({ ok: true, value: github });
  });
});
