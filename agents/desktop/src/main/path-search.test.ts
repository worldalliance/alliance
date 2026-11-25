import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findOnPath } from "./path-search";

let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("finds the first executable file on PATH, past missing, non-executable and directory candidates", () => {
  root = mkdtempSync(path.join(tmpdir(), "path-search-"));
  const folders = ["without", "plain", "dir", "with", "later"];
  for (const folder of folders) mkdirSync(path.join(root, folder));
  const tool = (folder: string) => path.join(root, folder, "tool");
  writeFileSync(tool("plain"), "", { mode: 0o644 });
  mkdirSync(tool("dir"));
  writeFileSync(tool("with"), "", { mode: 0o755 });
  writeFileSync(tool("later"), "", { mode: 0o755 });
  const PATH = folders
    .map((folder) => path.join(root, folder))
    .join(path.delimiter);
  expect(findOnPath("tool", { PATH })).toBe(path.join(root, "with", "tool"));
});

test("finds nothing when no folder on PATH has it", () => {
  root = mkdtempSync(path.join(tmpdir(), "path-search-"));
  expect(findOnPath("tool", { PATH: root })).toBeUndefined();
});
