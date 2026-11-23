import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TasksStatus, TaskStatus } from "../../shared/task";
import { git } from "../repository/testing/fixture";
import { steeringFile } from "./testing/fixture";
import {
  checkout,
  dir,
  service,
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
