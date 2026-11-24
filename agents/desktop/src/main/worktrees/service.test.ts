import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Result } from "../../../../../common/src/result";
import { WorktreesStatus, WorktreeStatus } from "../../shared/worktree";
import { git } from "../repository/testing/fixture";
import { steeringFile } from "./testing/fixture";
import {
  checkout,
  closedIn,
  dir,
  service,
  setOnClose,
  setUp,
  tearDown,
} from "./testing/service-fixture";

beforeEach(setUp);
afterEach(tearDown);

test("has no worktrees without a repository", async () => {
  const { worktrees } = service({ checkout: () => undefined });
  await worktrees.refresh();
  expect(worktrees.current()).toEqual({
    status: WorktreesStatus.NoRepository,
    worktrees: [],
    created: {},
  });
});

test("a listing's problem goes once the repository does", async () => {
  writeFileSync(steeringFile(checkout, "fake-list-fails"), "");
  let found: string | undefined = checkout;
  const { worktrees } = service({ checkout: () => found });
  await worktrees.refresh();
  expect(worktrees.current().problem).toBeDefined();
  found = undefined;
  await worktrees.refresh();
  expect(worktrees.current()).toEqual({
    status: WorktreesStatus.NoRepository,
    worktrees: [],
    created: {},
    problem: undefined,
  });
});

test("lists worktrees other than the main checkout, and one whose folder is gone as broken", async () => {
  const outside = path.join(dir, "workspaces", "by-hand");
  git(checkout, "worktree", "add", "-q", "-b", "by-hand", outside);
  const gone = path.join(dir, "workspaces", "gone");
  git(checkout, "worktree", "add", "-q", "-b", "gone", gone);
  rmSync(gone, { recursive: true });
  const { worktrees } = service();
  await worktrees.refresh();
  expect(worktrees.current()).toEqual({
    status: WorktreesStatus.Listed,
    problem: undefined,
    created: {},
    worktrees: [
      {
        key: outside,
        name: "by-hand",
        folder: outside,
        branch: "by-hand",
        parent: undefined,
        archived: false,
        state: { status: WorktreeStatus.Ready, problem: undefined },
      },
      expect.objectContaining({
        key: gone,
        state: {
          status: WorktreeStatus.Broken,
          problem: expect.stringContaining("Its folder is gone."),
        },
      }),
    ],
  });
});

test("a worktree recorded as made from inside another worktree names that worktree as its parent, unless its parents loop", async () => {
  const records = steeringFile(checkout, "fake-records");
  mkdirSync(records);
  for (const { name, parent } of [
    { name: "outer" },
    { name: "inner", parent: "id-outer" },
    { name: "loop-a", parent: "id-loop-b" },
    { name: "loop-b", parent: "id-loop-a" },
    { name: "below-loop", parent: "id-loop-a" },
  ]) {
    git(
      checkout,
      "worktree",
      "add",
      "-q",
      "-b",
      name,
      path.join(dir, "workspaces", name),
    );
    writeFileSync(
      path.join(records, name),
      JSON.stringify({ id: `id-${name}`, name, state: "recorded", parent }),
    );
  }
  const { worktrees } = service();
  await worktrees.refresh();
  expect(
    Object.fromEntries(
      worktrees.current().worktrees.map(({ key, parent }) => [key, parent]),
    ),
  ).toEqual({
    "id-inner": "id-outer",
    "id-outer": undefined,
    "id-loop-a": undefined,
    "id-loop-b": undefined,
    "id-below-loop": undefined,
  });
  expect(
    worktrees
      .current()
      .worktrees.filter(({ state }) => state.status === WorktreeStatus.Broken)
      .map(({ key }) => key)
      .sort(),
  ).toEqual(["id-below-loop", "id-loop-a", "id-loop-b"]);
});

test("archiving closes the worktree's sessions and hides it until restored, counting it archived from its save on, even before a relaunch lists it", async () => {
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    name: "Fix it",
  });
  if (!created.ok) throw new Error(created.error.message);
  const { key, folder } = created.value;
  const whileClosing: Promise<boolean>[] = [];
  setOnClose(() => {
    whileClosing.push(worktrees.isArchived(folder));
  });
  expect(await worktrees.isArchived(folder)).toBe(false);
  expect(await worktrees.archive(key)).toEqual({ ok: true, value: undefined });
  expect(closedIn).toEqual([folder]);
  expect(await Promise.all(whileClosing)).toEqual([true]);
  expect(await worktrees.isArchived(folder)).toBe(true);
  expect(worktrees.current().worktrees[0]).toMatchObject({
    key,
    archived: true,
  });
  expect(existsSync(folder)).toBe(true);

  const relaunched = service().worktrees;
  expect(await relaunched.isArchived(folder)).toBe(true);
  await relaunched.refresh();
  expect(relaunched.current().worktrees[0]).toMatchObject({
    key,
    name: "fix-it",
    archived: true,
  });
  await relaunched.restore(key);
  expect(relaunched.current().worktrees[0]).toMatchObject({ archived: false });
  expect(await relaunched.isArchived(folder)).toBe(false);
});

test("a worktree stays archived once the app points at another checkout", async () => {
  let current = checkout;
  const { worktrees } = service({ checkout: () => current });
  const created = await worktrees.create({
    creationId: "c1",
    name: "Fix it",
  });
  if (!created.ok) throw new Error(created.error.message);
  await worktrees.archive(created.value.key);
  current = path.join(dir, "workspaces", "other");
  git(dir, "clone", "-q", checkout, current);
  await worktrees.refresh();
  expect(worktrees.current().worktrees).toEqual([]);
  expect(await worktrees.isArchived(created.value.folder)).toBe(true);
});

test("archiving hides the worktree once its agents stop, not before, and without waiting for another listing", async () => {
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    name: "Fix it",
  });
  if (!created.ok) throw new Error(created.error.message);
  let shownArchived: boolean | undefined;
  setOnClose(async () => {
    await worktrees.refresh();
    shownArchived = worktrees.current().worktrees[0]?.archived;
    writeFileSync(steeringFile(checkout, "fake-list-fails"), "");
  });
  expect((await worktrees.archive(created.value.key)).ok).toBe(true);
  expect(shownArchived).toBe(false);
  expect(worktrees.current()).toMatchObject({
    problem: undefined,
    worktrees: [{ key: created.value.key, archived: true }],
  });
});

test("a restore or another archive asked for while an archive saves or stops the worktree's agents is refused", async () => {
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    name: "Fix it",
  });
  if (!created.ok) throw new Error(created.error.message);
  const key = created.value.key;
  let during: Promise<Result<void, Error>>[] = [];
  setOnClose(() => {
    during.push(worktrees.restore(key), worktrees.archive(key));
  });
  const archiving = worktrees.archive(key);
  during = [worktrees.restore(key), worktrees.archive(key)];
  expect((await archiving).ok).toBe(true);
  expect(during).toHaveLength(4);
  for (const result of await Promise.all(during))
    expect(result).toMatchObject({ ok: false });
  expect(worktrees.current().worktrees[0]).toMatchObject({ archived: true });
  expect(await worktrees.isArchived(created.value.folder)).toBe(true);
});

test("a listing begun before an archive doesn't show the worktree unarchived", async () => {
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    name: "Fix it",
  });
  if (!created.ok) throw new Error(created.error.message);
  const listing = worktrees.refresh();
  await worktrees.archive(created.value.key);
  await listing;
  expect(worktrees.current().worktrees[0]).toMatchObject({ archived: true });
});

test("an archive that can't be saved stops no agents", async () => {
  const { worktrees } = service();
  const created = await worktrees.create({
    creationId: "c1",
    name: "Fix it",
  });
  if (!created.ok) throw new Error(created.error.message);
  mkdirSync(path.join(dir, "user-data"), { recursive: true });
  writeFileSync(path.join(dir, "user-data", "worktrees.json"), "not json");
  expect((await worktrees.archive(created.value.key)).ok).toBe(false);
  expect(closedIn).toEqual([]);
  expect(worktrees.current().worktrees[0]).toMatchObject({ archived: false });
  expect(await worktrees.isArchived(created.value.folder)).toBe(false);
});
