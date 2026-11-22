import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { TaskStore } from "./store";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function storeFile(): string {
  dir = mkdtempSync(path.join(tmpdir(), "tasks-"));
  return path.join(dir, "nested", "tasks.json");
}

test("lists nothing before the first task", async () => {
  expect(await new TaskStore(storeFile()).list()).toEqual({
    ok: true,
    value: [],
  });
});

test("updates each worktree's task in place, starting untitled", async () => {
  const store = new TaskStore(storeFile());
  await Promise.all([
    store.update("a", (task) => ({ ...task, title: "Fix it" })),
    store.update("b", (task) => task),
    store.update("a", (task) => ({ ...task, title: `${task.title} now` })),
  ]);
  const listed = await store.list();
  expect(listed.ok && listed.value).toEqual([
    { worktree: "b" },
    { worktree: "a", title: "Fix it now" },
  ]);
});

test("fails on a file that isn't a task list, and writes nothing over it", async () => {
  const file = storeFile();
  const store = new TaskStore(file);
  await store.update("a", (task) => task);
  writeFileSync(file, "{}");
  const listed = await store.list();
  expect(!listed.ok && listed.error.message).toContain("isn't a task list");
  expect((await store.update("a", (task) => task)).ok).toBe(false);
});
