import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Result } from "../../../../../common/src/result";
import { AgentKind } from "../../shared/agent-kind";
import { TasksStatus, TaskStatus } from "../../shared/task";
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

test("has no tasks without a repository", async () => {
  const { tasks } = service({ checkout: () => undefined });
  await tasks.refresh();
  expect(tasks.current()).toEqual({
    status: TasksStatus.NoRepository,
    tasks: [],
    created: {},
  });
});

test("a listing's problem goes once the repository does", async () => {
  writeFileSync(steeringFile(checkout, "fake-list-fails"), "");
  let found: string | undefined = checkout;
  const { tasks } = service({ checkout: () => found });
  await tasks.refresh();
  expect(tasks.current().problem).toBeDefined();
  found = undefined;
  await tasks.refresh();
  expect(tasks.current()).toEqual({
    status: TasksStatus.NoRepository,
    tasks: [],
    created: {},
    problem: undefined,
  });
});

test("lists worktrees other than the main checkout, each made outside the app until it creates one, and one whose folder is gone as broken", async () => {
  const outside = path.join(dir, "workspaces", "by-hand");
  git(checkout, "worktree", "add", "-q", "-b", "by-hand", outside);
  const gone = path.join(dir, "workspaces", "gone");
  git(checkout, "worktree", "add", "-q", "-b", "gone", gone);
  rmSync(gone, { recursive: true });
  const { tasks } = service();
  await tasks.refresh();
  expect(tasks.current()).toEqual({
    status: TasksStatus.Listed,
    problem: undefined,
    created: {},
    tasks: [
      {
        key: outside,
        title: "by-hand",
        folder: outside,
        branch: "by-hand",
        parent: undefined,
        createdByApp: false,
        archived: false,
        state: { status: TaskStatus.Ready, problem: undefined },
      },
      expect.objectContaining({
        key: gone,
        state: {
          status: TaskStatus.Broken,
          problem: expect.stringContaining("Its folder is gone."),
        },
      }),
    ],
  });
});

test("a worktree recorded as made from inside another task names that task as its parent, unless its parents loop", async () => {
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
  const { tasks } = service();
  await tasks.refresh();
  expect(
    Object.fromEntries(
      tasks.current().tasks.map(({ key, parent }) => [key, parent]),
    ),
  ).toEqual({
    "id-inner": "id-outer",
    "id-outer": undefined,
    "id-loop-a": undefined,
    "id-loop-b": undefined,
    "id-below-loop": undefined,
  });
  expect(
    tasks
      .current()
      .tasks.filter(({ state }) => state.status === TaskStatus.Broken)
      .map(({ key }) => key)
      .sort(),
  ).toEqual(["id-below-loop", "id-loop-a", "id-loop-b"]);
});

test("archiving closes the task's sessions and hides it until restored, counting it archived from its save on, even before a relaunch lists it", async () => {
  const { tasks } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  if (!created.ok) throw new Error(created.error.message);
  const { key, folder } = created.value;
  const whileClosing: Promise<boolean>[] = [];
  setOnClose(() => {
    whileClosing.push(tasks.isArchived(folder));
  });
  expect(await tasks.isArchived(folder)).toBe(false);
  expect(await tasks.archive(key)).toEqual({ ok: true, value: undefined });
  expect(closedIn).toEqual([folder]);
  expect(await Promise.all(whileClosing)).toEqual([true]);
  expect(await tasks.isArchived(folder)).toBe(true);
  expect(tasks.current().tasks[0]).toMatchObject({ key, archived: true });
  expect(existsSync(folder)).toBe(true);

  const relaunched = service().tasks;
  expect(await relaunched.isArchived(folder)).toBe(true);
  await relaunched.refresh();
  expect(relaunched.current().tasks[0]).toMatchObject({
    key,
    title: "Fix it",
    archived: true,
  });
  await relaunched.restore(key);
  expect(relaunched.current().tasks[0]).toMatchObject({ archived: false });
  expect(await relaunched.isArchived(folder)).toBe(false);
});

test("a task stays archived once the app points at another checkout", async () => {
  let current = checkout;
  const { tasks } = service({ checkout: () => current });
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  if (!created.ok) throw new Error(created.error.message);
  await tasks.archive(created.value.key);
  current = path.join(dir, "workspaces", "other");
  git(dir, "clone", "-q", checkout, current);
  await tasks.refresh();
  expect(tasks.current().tasks).toEqual([]);
  expect(await tasks.isArchived(created.value.folder)).toBe(true);
});

test("archiving hides the task once its agents stop, not before, and without waiting for another listing", async () => {
  const { tasks } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  if (!created.ok) throw new Error(created.error.message);
  let shownArchived: boolean | undefined;
  setOnClose(async () => {
    await tasks.refresh();
    shownArchived = tasks.current().tasks[0]?.archived;
    writeFileSync(steeringFile(checkout, "fake-list-fails"), "");
  });
  expect((await tasks.archive(created.value.key)).ok).toBe(true);
  expect(shownArchived).toBe(false);
  expect(tasks.current()).toMatchObject({
    problem: undefined,
    tasks: [{ key: created.value.key, archived: true }],
  });
});

test("a restore or another archive asked for while an archive saves or stops the task's agents is refused", async () => {
  const { tasks } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  if (!created.ok) throw new Error(created.error.message);
  const key = created.value.key;
  let during: Promise<Result<void, Error>>[] = [];
  setOnClose(() => {
    during.push(tasks.restore(key), tasks.archive(key));
  });
  const archiving = tasks.archive(key);
  during = [tasks.restore(key), tasks.archive(key)];
  expect((await archiving).ok).toBe(true);
  expect(during).toHaveLength(4);
  for (const result of await Promise.all(during))
    expect(result).toMatchObject({ ok: false });
  expect(tasks.current().tasks[0]).toMatchObject({ archived: true });
  expect(await tasks.isArchived(created.value.folder)).toBe(true);
});

test("a listing begun before an archive doesn't show the task unarchived", async () => {
  const { tasks } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  if (!created.ok) throw new Error(created.error.message);
  const listing = tasks.refresh();
  await tasks.archive(created.value.key);
  await listing;
  expect(tasks.current().tasks[0]).toMatchObject({ archived: true });
});

test("an archive that can't be saved stops no agents", async () => {
  const { tasks } = service();
  const created = await tasks.create({
    creationId: "c1",
    request: "Fix it",
    agent: AgentKind.Claude,
  });
  if (!created.ok) throw new Error(created.error.message);
  writeFileSync(path.join(dir, "user-data", "tasks.json"), "not json");
  expect((await tasks.archive(created.value.key)).ok).toBe(false);
  expect(closedIn).toEqual([]);
  expect(tasks.current().tasks[0]).toMatchObject({ archived: false });
  expect(await tasks.isArchived(created.value.folder)).toBe(false);
});
