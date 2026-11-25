import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../common/src/result";
import {
  type RepositoryState,
  RepositoryStatus,
  UpdateBlockerKind,
} from "../../shared/repository";
import { type Git, gitAt } from "./git";
import { type SavedChoice, SavedKind, SavedRepository } from "./saved";
import { RepositoryService } from "./service";
import type { RepositorySource } from "./source";
import { commitFile, git, makeSource } from "./testing/fixture";

let dir: string;
let source: RepositorySource;
let savedFile: string;
const realGit = gitAt({ executable: "git", env: process.env });

beforeEach(() => {
  dir = realpathSync(mkdtempSync(path.join(tmpdir(), "repository-")));
  source = makeSource({
    folder: path.join(dir, "source"),
    defaultFolder: path.join(dir, "workspaces", "alliance"),
  });
  savedFile = path.join(dir, "user-data", "repository.json");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

function service(params: { ownCheckout?: string; git?: Git } = {}) {
  const repository = new RepositoryService({
    source,
    saved: new SavedRepository(savedFile),
    ownCheckout: params.ownCheckout,
    findGit: () => Promise.resolve(R.success(params.git ?? realGit)),
  });
  const seen: RepositoryState[] = [];
  repository.subscribe((state) => seen.push(state));
  const settled = (status: RepositoryStatus) =>
    new Promise<RepositoryState>((resolve) => {
      if (repository.current().status === status)
        return resolve(repository.current());
      const unsubscribe = repository.subscribe((state) => {
        if (state.status !== status) return;
        unsubscribe();
        resolve(state);
      });
    });
  return { repository, seen, settled };
}

const savedChoice = (): SavedChoice => {
  const { kind, folder } = JSON.parse(readFileSync(savedFile, "utf8"));
  return { kind, folder };
};

const cloneSource = (name: string) => {
  const copy = path.join(dir, name);
  git(dir, "clone", "-q", source.url, copy);
  return copy;
};

describe("RepositoryService", () => {
  test("on a machine with no copy, clones into the default folder by itself and saves it", async () => {
    const { repository, seen, settled } = service();
    await repository.locate({ autoClone: true });
    expect(await settled(RepositoryStatus.Ready)).toEqual({
      status: RepositoryStatus.Ready,
      folder: source.defaultFolder,
    });
    expect(seen.map((s) => s.status)).toContain(RepositoryStatus.Cloning);
    expect(savedChoice()).toEqual({
      kind: SavedKind.Copy,
      folder: source.defaultFolder,
    });
  });

  test("without autoClone, a free default folder waits to be cloned", async () => {
    const { repository } = service();
    await repository.locate({ autoClone: false });
    expect(repository.current()).toEqual({
      status: RepositoryStatus.NotSetUp,
      cloneFolder: source.defaultFolder,
      problem: undefined,
    });
  });

  test("Check again clones by itself only when leaving Needs Git", async () => {
    let found = false;
    const repository = new RepositoryService({
      source,
      saved: new SavedRepository(savedFile),
      findGit: () =>
        Promise.resolve(found ? R.success(realGit) : R.failure("No git.")),
    });
    await repository.locate({ autoClone: true });
    expect(repository.current().status).toBe(RepositoryStatus.GitMissing);
    found = true;
    await repository.checkAgain();
    expect(repository.current().status).toBe(RepositoryStatus.Cloning);
    await repository.cancelClone();

    rmSync(savedFile);
    const waiting = service().repository;
    await waiting.locate({ autoClone: false });
    await waiting.checkAgain();
    expect(waiting.current().status).toBe(RepositoryStatus.NotSetUp);
  });

  test("uses a copy already at the default folder without cloning", async () => {
    git(dir, "clone", "-q", source.url, source.defaultFolder);
    const { repository, seen } = service();
    await repository.locate({ autoClone: true });
    expect(repository.current()).toEqual({
      status: RepositoryStatus.Ready,
      folder: source.defaultFolder,
    });
    expect(seen.map((s) => s.status)).not.toContain(RepositoryStatus.Cloning);
  });

  test("prefers the saved choice, then the app's own checkout, to the default folder", async () => {
    const chosen = cloneSource("chosen");
    const own = cloneSource("own");
    git(dir, "clone", "-q", source.url, source.defaultFolder);
    mkdirSync(path.join(own, "agents"));
    const first = service({ ownCheckout: path.join(own, "agents") });
    await first.repository.locate({ autoClone: true });
    expect(first.repository.current()).toEqual({
      status: RepositoryStatus.Ready,
      folder: own,
    });

    const second = service({ ownCheckout: own });
    await second.repository.useExisting(chosen);
    const third = service({ ownCheckout: own });
    await third.repository.locate({ autoClone: true });
    expect(third.repository.current()).toEqual({
      status: RepositoryStatus.Ready,
      folder: chosen,
    });
  });

  test("a saved copy that is gone says so and doesn't clone", async () => {
    const chosen = cloneSource("chosen");
    await service().repository.useExisting(chosen);
    rmSync(chosen, { recursive: true });
    const { repository, seen } = service();
    await repository.locate({ autoClone: true });
    const state = repository.current();
    expect(state.status).toBe(RepositoryStatus.NotSetUp);
    expect(
      state.status === RepositoryStatus.NotSetUp && state.problem?.message,
    ).toBe(
      `The Alliance repository at ${chosen} is gone. Clone it again or use an existing copy.`,
    );
    expect(seen.map((s) => s.status)).not.toContain(RepositoryStatus.Cloning);
  });

  test("a default folder with other files in it is left alone", async () => {
    mkdirSync(source.defaultFolder, { recursive: true });
    writeFileSync(path.join(source.defaultFolder, "notes.txt"), "mine");
    const { repository } = service();
    await repository.locate({ autoClone: true });
    const state = repository.current();
    expect(
      state.status === RepositoryStatus.NotSetUp && state.problem?.message,
    ).toContain("already has other files in it");
    expect(readdirSync(source.defaultFolder)).toEqual(["notes.txt"]);
  });

  test("a folder that isn't a copy is refused, keeping the state", async () => {
    const { repository } = service();
    await repository.locate({ autoClone: false });
    const before = repository.current();
    const plain = path.join(dir, "plain");
    mkdirSync(plain);
    const used = await repository.useExisting(plain);
    expect(!used.ok && used.error.message).toBe(
      `${plain} isn't a copy of the Alliance repository.`,
    );
    expect(repository.current()).toEqual(before);
    expect(existsSync(savedFile)).toBe(false);
  });

  test("changing the clone folder to one with files clones into a new folder inside it", async () => {
    const { repository, settled } = service();
    await repository.locate({ autoClone: false });
    const parent = path.join(dir, "code");
    mkdirSync(parent);
    writeFileSync(path.join(parent, "other.txt"), "");
    expect((await repository.changeCloneFolder(parent)).ok).toBe(true);
    expect(await repository.clone()).toEqual({ ok: true, value: undefined });
    expect(await settled(RepositoryStatus.Ready)).toEqual({
      status: RepositoryStatus.Ready,
      folder: path.join(parent, "alliance"),
    });
  });

  test("changing the clone folder to a copy of the repository is refused, keeping the state", async () => {
    const { repository } = service();
    await repository.locate({ autoClone: false });
    const before = repository.current();
    const copy = cloneSource("copy");
    const changed = await repository.changeCloneFolder(copy);
    expect(!changed.ok && changed.error.message).toBe(
      `${copy} is already in a copy of the Alliance repository. Use existing copy instead.`,
    );
    expect(repository.current()).toEqual(before);
    expect(existsSync(savedFile)).toBe(false);
  });

  test("changing the clone folder to the parent of a copy points to that copy", async () => {
    const { repository } = service();
    await repository.locate({ autoClone: false });
    const parent = path.join(dir, "code");
    mkdirSync(parent);
    git(dir, "clone", "-q", source.url, path.join(parent, "alliance"));
    const changed = await repository.changeCloneFolder(parent);
    expect(!changed.ok && changed.error.message).toBe(
      `${path.join(parent, "alliance")} is already a copy of the Alliance repository. Use existing copy instead.`,
    );
  });

  test("changing the clone folder to an empty or missing folder in a copy is refused", async () => {
    const { repository } = service();
    await repository.locate({ autoClone: false });
    const copy = cloneSource("copy");
    const empty = path.join(copy, "empty");
    mkdirSync(empty);
    for (const picked of [empty, path.join(copy, "missing", "deeper")]) {
      const changed = await repository.changeCloneFolder(picked);
      expect(!changed.ok && changed.error.message).toBe(
        `${picked} is already in a copy of the Alliance repository. Use existing copy instead.`,
      );
    }
    expect(existsSync(savedFile)).toBe(false);
  });

  test("a changed clone folder is kept after a relaunch, which doesn't clone by itself", async () => {
    const first = service();
    await first.repository.locate({ autoClone: false });
    const elsewhere = path.join(dir, "elsewhere");
    expect((await first.repository.changeCloneFolder(elsewhere)).ok).toBe(true);

    const { repository, seen } = service();
    await repository.locate({ autoClone: true });
    expect(repository.current()).toEqual({
      status: RepositoryStatus.NotSetUp,
      cloneFolder: elsewhere,
      problem: undefined,
    });
    expect(seen.map((s) => s.status)).not.toContain(RepositoryStatus.Cloning);
  });

  test("a copy in the saved clone folder is used, so a clone whose save failed isn't lost", async () => {
    const elsewhere = cloneSource("elsewhere");
    await new SavedRepository(savedFile).write({
      kind: SavedKind.CloneFolder,
      folder: elsewhere,
    });
    const { repository } = service();
    await repository.locate({ autoClone: true });
    expect(repository.current()).toEqual({
      status: RepositoryStatus.Ready,
      folder: elsewhere,
    });
  });

  test("cancelling a clone leaves the folder free, waits to be cloned, and stays cancelled after a relaunch", async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const slowGit: Git = {
      ...realGit,
      run: async (input) => {
        if (input.args[0] === "clone") await held;
        return realGit.run(input);
      },
    };
    const { repository, settled } = service({ git: slowGit });
    await repository.locate({ autoClone: true });
    expect(repository.current().status).toBe(RepositoryStatus.Cloning);
    const cancelled = repository.cancelClone();
    release();
    await cancelled;
    expect(await settled(RepositoryStatus.NotSetUp)).toEqual({
      status: RepositoryStatus.NotSetUp,
      cloneFolder: source.defaultFolder,
    });
    expect(readdirSync(path.join(dir, "workspaces"))).toEqual([]);

    const relaunched = service();
    await relaunched.repository.locate({ autoClone: true });
    expect(relaunched.repository.current()).toEqual({
      status: RepositoryStatus.NotSetUp,
      cloneFolder: source.defaultFolder,
      problem: undefined,
    });
  });

  test("a cancel that lands after git finishes keeps and saves the clone", async () => {
    let cancelled: Promise<void> | undefined;
    const saved = new SavedRepository(savedFile);
    const write = saved.write.bind(saved);
    saved.write = (choice) => {
      cancelled = repository.cancelClone();
      return write(choice);
    };
    const repository = new RepositoryService({
      source,
      saved,
      findGit: () => Promise.resolve(R.success(realGit)),
    });
    await repository.locate({ autoClone: true });
    while (!cancelled) await Bun.sleep(10);
    await cancelled;
    expect(repository.current()).toEqual({
      status: RepositoryStatus.Ready,
      folder: source.defaultFolder,
    });
    expect(savedChoice()).toEqual({
      kind: SavedKind.Copy,
      folder: source.defaultFolder,
    });
  });

  test("a folder change that lands after git finishes keeps the clone", async () => {
    let changed: Promise<unknown> | undefined;
    const saved = new SavedRepository(savedFile);
    const write = saved.write.bind(saved);
    saved.write = (choice) => {
      changed ??= repository.changeCloneFolder(path.join(dir, "elsewhere"));
      return write(choice);
    };
    const repository = new RepositoryService({
      source,
      saved,
      findGit: () => Promise.resolve(R.success(realGit)),
    });
    await repository.locate({ autoClone: true });
    while (!changed) await Bun.sleep(10);
    expect(await changed).toEqual({
      ok: false,
      error: { message: "The repository isn't waiting to be cloned." },
    });
    expect(repository.current()).toEqual({
      status: RepositoryStatus.Ready,
      folder: source.defaultFolder,
    });
    expect(savedChoice()).toEqual({
      kind: SavedKind.Copy,
      folder: source.defaultFolder,
    });
    expect(existsSync(path.join(dir, "elsewhere"))).toBe(false);
  });

  test("a cancel while changing the clone folder stops the restarted clone", async () => {
    const stuckGit: Git = {
      ...realGit,
      run: async (input) => {
        if (input.args[0] === "clone" && !input.signal?.aborted)
          await new Promise((resolve) =>
            input.signal?.addEventListener("abort", resolve, { once: true }),
          );
        return realGit.run(input);
      },
    };
    const { repository } = service({ git: stuckGit });
    await repository.locate({ autoClone: true });
    const elsewhere = path.join(dir, "elsewhere");
    const changed = repository.changeCloneFolder(elsewhere);
    await repository.cancelClone();
    expect((await changed).ok).toBe(true);
    expect(repository.current()).toEqual({
      status: RepositoryStatus.NotSetUp,
      cloneFolder: elsewhere,
    });
    expect(savedChoice()).toEqual({
      kind: SavedKind.CloneFolder,
      folder: elsewhere,
    });
    expect(existsSync(elsewhere)).toBe(false);
  });

  test("a launch lookup during Use existing copy waits for it rather than cloning", async () => {
    const copy = cloneSource("mine");
    const saved = new SavedRepository(savedFile);
    const writing = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const write = saved.write.bind(saved);
    saved.write = async (choice) => {
      writing.resolve();
      await release.promise;
      return write(choice);
    };
    const repository = new RepositoryService({
      source,
      saved,
      findGit: () => Promise.resolve(R.success(realGit)),
    });
    const seen: RepositoryStatus[] = [];
    repository.subscribe((state) => seen.push(state.status));
    const used = repository.useExisting(copy);
    await writing.promise;
    const located = repository.locate({ autoClone: true });
    release.resolve();
    await Promise.all([used, located]);
    expect(seen).not.toContain(RepositoryStatus.Cloning);
    expect(repository.current()).toEqual({
      status: RepositoryStatus.Ready,
      folder: copy,
    });
  });

  test("closing mid-clone waits for git and removes the partial folder", async () => {
    const { repository } = service();
    await repository.locate({ autoClone: true });
    await repository.close();
    expect(readdirSync(path.join(dir, "workspaces"))).toEqual([]);
  });

  test("updates an outdated copy on main and its origin/main to the source's latest main", async () => {
    const copy = cloneSource("copy");
    git(copy, "reset", "-q", "--hard", source.firstCommit);
    git(copy, "update-ref", "refs/remotes/origin/main", source.firstCommit);
    const { repository } = service();
    await repository.useExisting(copy);
    expect(repository.current()).toEqual({
      status: RepositoryStatus.UpdateNeeded,
      folder: copy,
      blocker: undefined,
    });
    expect(await repository.update()).toEqual({ ok: true, value: undefined });
    expect(repository.current()).toEqual({
      status: RepositoryStatus.Ready,
      folder: copy,
    });
    expect(git(copy, "rev-parse", "HEAD")).toBe(source.minimumCommit);
    expect(git(copy, "rev-parse", "origin/main")).toBe(source.minimumCommit);
  });

  test("an update that can't fast-forward keeps the copy and says why", async () => {
    const copy = cloneSource("copy");
    git(copy, "reset", "-q", "--hard", source.firstCommit);
    const local = commitFile({
      folder: copy,
      file: "local.txt",
      message: "Local",
    });
    const { repository } = service();
    await repository.useExisting(copy);
    expect((await repository.update()).ok).toBe(true);
    const state = repository.current();
    expect(
      state.status === RepositoryStatus.UpdateNeeded && state.problem?.message,
    ).toBe(
      "Alliance agent couldn't fast-forward main. Fix what git reports in the details, then try again.",
    );
    expect(git(copy, "rev-parse", "HEAD")).toBe(local);
  });

  test("an update finds the copy switched off main since the check and leaves it", async () => {
    const copy = cloneSource("copy");
    git(copy, "reset", "-q", "--hard", source.firstCommit);
    const { repository } = service();
    await repository.useExisting(copy);
    git(copy, "switch", "-q", "-c", "feature");
    expect((await repository.update()).ok).toBe(true);
    expect(repository.current()).toEqual({
      status: RepositoryStatus.UpdateNeeded,
      folder: copy,
      blocker: { kind: UpdateBlockerKind.OnBranch, branch: "feature" },
    });
    expect(git(copy, "rev-parse", "HEAD")).toBe(source.firstCommit);
  });

  test("cancelling an update's stalled download leaves the copy outdated", async () => {
    const copy = cloneSource("copy");
    git(copy, "reset", "-q", "--hard", source.firstCommit);
    let fetching = () => {};
    const fetchStarted = new Promise<void>((resolve) => (fetching = resolve));
    const stalledGit: Git = {
      ...realGit,
      run: (input) => {
        if (!input.args.includes("fetch")) return realGit.run(input);
        fetching();
        return new Promise((resolve) =>
          input.signal?.addEventListener("abort", () =>
            resolve(R.failure(new Error("aborted"))),
          ),
        );
      },
    };
    const { repository } = service({ git: stalledGit });
    await repository.useExisting(copy);
    const updated = repository.update();
    await fetchStarted;
    repository.cancelUpdate();
    expect(await updated).toEqual({ ok: true, value: undefined });
    expect(repository.current()).toEqual({
      status: RepositoryStatus.UpdateNeeded,
      folder: copy,
      problem: undefined,
    });
    expect(git(copy, "rev-parse", "HEAD")).toBe(source.firstCommit);
  });

  test("git missing says how to install it", async () => {
    const repository = new RepositoryService({
      source,
      saved: new SavedRepository(savedFile),
      findGit: () => Promise.resolve(R.failure("Install Git.")),
    });
    await repository.locate({ autoClone: true });
    expect(repository.current()).toEqual({
      status: RepositoryStatus.GitMissing,
      message: "Install Git.",
    });
  });
});
