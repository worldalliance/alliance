import { expect, test } from "bun:test";
import path from "node:path";
import {
  listWorktrees,
  WorktreeState as ScriptWorktreeState,
} from "../../../../../scripts/list-worktrees";
import { ListedWorktreeState, parseWorktreeList } from "./list";

const entry = {
  path: "/w/alliance-fix",
  state: "recorded",
  problem: null,
  id: "record-1",
  name: "fix",
  branch: "fix",
  parent: "main",
  ports: { server: 3105, frontend: 5273, admin: 5274, mobile: 8185 },
  locked: false,
  prunable: false,
};

test("reads version 1, ignoring fields the app doesn't use or know", () => {
  const parsed = parseWorktreeList(
    JSON.stringify({ version: 1, worktrees: [{ ...entry, later: true }] }),
  );
  expect(parsed).toEqual({
    ok: true,
    value: [
      {
        path: "/w/alliance-fix",
        state: ListedWorktreeState.Recorded,
        problem: null,
        id: "record-1",
        name: "fix",
        branch: "fix",
        parent: "main",
        prunable: false,
      },
    ],
  });
});

test("refuses another version, naming both", () => {
  const parsed = parseWorktreeList(
    JSON.stringify({ version: 2, worktrees: [] }),
  );
  expect(!parsed.ok && parsed.error.message).toContain(
    "printed version 2 of its list, and this Alliance agent reads version 1",
  );
});

test("refuses output that isn't JSON or isn't a list", () => {
  expect(parseWorktreeList("error: oops").ok).toBe(false);
  const parsed = parseWorktreeList(
    JSON.stringify({ version: 1, worktrees: [{ ...entry, state: "odd" }] }),
  );
  expect(!parsed.ok && parsed.error.message).toContain("can't read");
});

test("reads what the repository's scripts/list-worktrees.ts prints, and knows its every state", () => {
  const repo = path.resolve(import.meta.dir, "../../../../..");
  const parsed = parseWorktreeList(JSON.stringify(listWorktrees(repo)));
  expect(parsed.ok && parsed.value[0]?.state).toBe(ListedWorktreeState.Main);
  expect<string[]>(Object.values(ListedWorktreeState)).toEqual(
    Object.values(ScriptWorktreeState),
  );
});
