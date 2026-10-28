import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkWiki,
  EntryKind,
  type RepoReader,
} from "../common/src/wiki/check";
import { git } from "./lib/git";

// Only what git tracks or would track counts, as in CI's checkout; git also matches paths case-sensitively, unlike macOS.
function gitRepoReader(root: string): RepoReader {
  const files = new Set(
    git({
      repoRoot: root,
      args: ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    })
      .toString("utf8")
      .split("\0")
      .filter(
        (file) =>
          file !== "" &&
          fs
            .statSync(path.join(root, file), { throwIfNoEntry: false })
            ?.isFile(),
      ),
  );
  const children = new Map<string, Set<string>>();
  for (const file of files) {
    const segments = file.split("/");
    segments.forEach((segment, i) => {
      const dir = segments.slice(0, i).join("/");
      children.set(dir, (children.get(dir) ?? new Set()).add(segment));
    });
  }
  return {
    kind(repoPath) {
      if (files.has(repoPath)) return EntryKind.File;
      return children.has(repoPath) ? EntryKind.Directory : undefined;
    },
    read: (repoPath) => fs.readFileSync(path.join(root, repoPath), "utf8"),
    list: (dir) => [...(children.get(dir) ?? [])].sort(),
  };
}

function main(): void {
  const root =
    process.argv[2] ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const { problems, pageCount, recordCount } = checkWiki(gitRepoReader(root));
  for (const { path: file, position, message } of problems) {
    console.error(`${file}:${position.line}:${position.column}: ${message}`);
  }
  if (problems.length > 0) {
    console.error(`wikicheck: ${problems.length} problem(s)`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `wikicheck: ${pageCount} wiki page(s) and ${recordCount} provenance record(s) pass. Structure only: page accuracy still needs review against sources.`,
  );
}

if (import.meta.main) main();
