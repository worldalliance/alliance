// Exits 0 on matches, since some copies should stay separate.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { git, mergeBaseFromArgs } from "./lib/git";
import { findNewRepeatedCopy } from "./lib/repeated-copy";
import {
  readSourceConfig,
  scannedFiles,
  type SourceConfig,
} from "./lib/source-files";

const jscpd = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/.bin/jscpd",
);

const fragment = z.object({
  name: z.string(),
  start: z.number(),
  end: z.number(),
});

const reportSchema = z.object({
  duplicates: z.array(
    z.object({
      firstFile: fragment,
      secondFile: fragment,
      lines: z.number(),
      isNew: z.boolean(),
    }),
  ),
});

function readWorkingTree(
  repoRoot: string,
  config: SourceConfig,
): Map<string, string> {
  const listing = git({
    repoRoot,
    args: [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ...config.path,
    ],
  });
  const files = new Map<string, string>();
  for (const file of scannedFiles(
    config,
    listing.toString("utf8").split("\0"),
  )) {
    const absolute = path.join(repoRoot, file);
    if (fs.existsSync(absolute)) {
      files.set(file, fs.readFileSync(absolute, "utf8"));
    }
  }
  return files;
}

function readAtRef({
  repoRoot,
  config,
  ref,
}: {
  repoRoot: string;
  config: SourceConfig;
  ref: string;
}): Map<string, string> {
  const listing = git({
    repoRoot,
    args: ["ls-tree", "-r", "-z", "--name-only", ref, "--", ...config.path],
  });
  const names = scannedFiles(config, listing.toString("utf8").split("\0"));
  const batch = git({
    repoRoot,
    args: ["cat-file", "--batch"],
    input: names.map((file) => `${ref}:${file}\n`).join(""),
  });
  const files = new Map<string, string>();
  let pos = 0;
  for (const file of names) {
    const headerEnd = batch.indexOf(10, pos);
    const size = Number(batch.toString("utf8", pos, headerEnd).split(" ")[2]);
    if (!Number.isInteger(size)) throw new Error(`git cat-file: ${file}`);
    files.set(
      file,
      batch.toString("utf8", headerEnd + 1, headerEnd + 1 + size),
    );
    pos = headerEnd + 1 + size + 1;
  }
  return files;
}

function preview(text: string): string {
  return text.length > 100 ? `${text.slice(0, 100)}…` : text;
}

function main(): void {
  const { base, repoRoot, baseCommit } = mergeBaseFromArgs();
  const config = readSourceConfig(repoRoot);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "dupcheck-"));

  try {
    const run = spawnSync(
      jscpd,
      [
        "--config",
        ".jscpd.json",
        "--baseline-from-ref",
        baseCommit,
        "--fail-on-empty",
        "--reporters",
        "json",
        "--output",
        outDir,
        "--absolute",
        "--no-colors",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (run.status !== 0) {
      console.error(
        `dupcheck: jscpd failed\n${run.error ?? `${run.stderr}${run.stdout}`}`,
      );
      process.exitCode = 2;
      return;
    }

    const report = reportSchema.parse(
      JSON.parse(
        fs.readFileSync(path.join(outDir, "jscpd-report.json"), "utf8"),
      ),
    );
    const at = (f: z.infer<typeof fragment>) =>
      `${path.relative(repoRoot, f.name)}:${f.start}-${f.end}`;
    // jscpd can mark an old pair as the new clone and the pair naming the new
    // copy as old, so each new clone is printed with every copy that shares a
    // fragment with it.
    const peers = new Map<string, Set<string>>();
    for (const d of report.duplicates) {
      const pair = [at(d.firstFile), at(d.secondFile)];
      for (const key of pair) {
        peers.set(key, new Set([...(peers.get(key) ?? []), ...pair]));
      }
    }
    const added = new Map<string, number>();
    for (const d of report.duplicates.filter((d) => d.isNew)) {
      const copies = new Set([
        ...(peers.get(at(d.firstFile)) ?? []),
        ...(peers.get(at(d.secondFile)) ?? []),
      ]);
      added.set([...copies].sort().join(" ≈ "), d.lines);
    }
    const copy = findNewRepeatedCopy({
      current: readWorkingTree(repoRoot, config),
      base: readAtRef({ repoRoot, config, ref: baseCommit }),
    });

    if (added.size === 0 && copy.length === 0) {
      console.log(
        `dupcheck: no new duplicated code or repeated text against ${base}. It only matches exact copies, so the same rule or message written differently still needs a search.`,
      );
      return;
    }

    if (added.size > 0) {
      console.log(`dupcheck: ${added.size} new clone(s) against ${base}`);
      for (const [copies, lines] of added) {
        console.log(`  ${copies} (${lines} lines)`);
      }
    }
    if (copy.length > 0) {
      console.log(
        `dupcheck: ${copy.length} newly repeated string(s) against ${base}`,
      );
      for (const { text, occurrences } of copy) {
        console.log(`  "${preview(text)}"`);
        for (const o of occurrences) console.log(`    ${o.file}:${o.line}`);
      }
    }
    console.log(
      "These are exact matches, not verdicts and not the full list: code or text that looks alike can follow different rules or target different platforms, and the same rule or message written differently goes unmatched. Any edit inside duplication the base already had, even a comment, can also show up, whole or split into pieces. `// jscpd:ignore-start` / `// jscpd:ignore-end` around a block keeps it out of future runs.",
    );
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`dupcheck: ${error}`);
  process.exitCode = 2;
}
