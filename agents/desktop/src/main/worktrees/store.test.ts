import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { WorktreeStore } from "./store";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function storeFile(): string {
  dir = mkdtempSync(path.join(tmpdir(), "worktrees-"));
  return path.join(dir, "nested", "worktrees.json");
}

test("lists nothing before the first worktree", async () => {
  expect(await new WorktreeStore(storeFile()).list()).toEqual({
    ok: true,
    value: [],
  });
});

test("updates each saved worktree in place, starting unarchived and untitled", async () => {
  const store = new WorktreeStore(storeFile());
  await Promise.all([
    store.update("a", (saved) => ({ ...saved, title: "Fix it" })),
    store.update("b", (saved) => ({ ...saved, archived: true })),
    store.update("a", (saved) => ({ ...saved, archived: true })),
  ]);
  const listed = await store.list();
  expect(listed.ok && listed.value).toEqual([
    { key: "b", archived: true },
    { key: "a", title: "Fix it", archived: true },
  ]);
});

test("fails on a file that isn't a worktree list, and writes nothing over it", async () => {
  const file = storeFile();
  const store = new WorktreeStore(file);
  await store.update("a", (saved) => saved);
  writeFileSync(file, "{}");
  const listed = await store.list();
  expect(!listed.ok && listed.error.message).toContain("isn't a worktree list");
  expect((await store.update("a", (saved) => saved)).ok).toBe(false);
});
