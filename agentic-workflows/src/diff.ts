import { R, type Result } from "@alliance/common/result";
import { gitText } from "./git";
import {
  DiffLineKind,
  type CommitDiff,
  type DiffFile,
  type DiffHunk,
} from "./types";

/** Git's empty tree, which is what a root commit has to be diffed against. */
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

const FILE_HEADER = /^diff --git a\/(.*) b\/(.*)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function headerPath(path: string): string | null {
  return path === "/dev/null" ? null : path.replace(/^[ab]\//, "");
}

export function parseDiff(output: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldNumber = 0;
  let newNumber = 0;

  for (const line of output.split("\n")) {
    const header = FILE_HEADER.exec(line);
    if (header) {
      file = {
        oldPath: header[1] ?? null,
        newPath: header[2] ?? null,
        binary: false,
        hunks: [],
        added: 0,
        removed: 0,
      };
      hunk = null;
      files.push(file);
      continue;
    }

    if (!file) continue;

    if (line.startsWith("--- ")) {
      file.oldPath = headerPath(line.slice(4));
      continue;
    }
    if (line.startsWith("+++ ")) {
      file.newPath = headerPath(line.slice(4));
      continue;
    }
    if (line.startsWith("Binary files ")) {
      file.binary = true;
      continue;
    }

    const bounds = HUNK_HEADER.exec(line);
    if (bounds) {
      oldNumber = Number(bounds[1]);
      newNumber = Number(bounds[2]);
      hunk = { header: line, lines: [] };
      file.hunks.push(hunk);
      continue;
    }

    if (!hunk) continue;

    if (line.startsWith("+")) {
      hunk.lines.push({
        kind: DiffLineKind.Added,
        oldNumber: null,
        newNumber: newNumber++,
        text: line.slice(1),
      });
      file.added++;
    } else if (line.startsWith("-")) {
      hunk.lines.push({
        kind: DiffLineKind.Removed,
        oldNumber: oldNumber++,
        newNumber: null,
        text: line.slice(1),
      });
      file.removed++;
    } else if (line.startsWith(" ")) {
      hunk.lines.push({
        kind: DiffLineKind.Context,
        oldNumber: oldNumber++,
        newNumber: newNumber++,
        text: line.slice(1),
      });
    }
  }

  return files;
}

export async function commitDiff(params: {
  cwd: string;
  oldest: string;
  newest: string;
}): Promise<Result<CommitDiff, string>> {
  const parent = await gitText({
    args: ["rev-parse", "--verify", "--quiet", `${params.oldest}^`],
    cwd: params.cwd,
  });
  const base = parent.ok ? parent.value.trim() : EMPTY_TREE;

  const output = await gitText({
    args: ["diff", "--no-color", "--find-renames", base, params.newest],
    cwd: params.cwd,
  });
  if (!output.ok) return output;

  const files = parseDiff(output.value);

  return R.success({
    base,
    head: params.newest,
    files,
    added: files.reduce((total, file) => total + file.added, 0),
    removed: files.reduce((total, file) => total + file.removed, 0),
  });
}
