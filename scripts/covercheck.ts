// Exits 0 on gaps, since some code is fine without a unit test.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  lineRanges,
  parseAddedLines,
  parseLcov,
  testFailures,
} from "./lib/coverage";
import { git, mergeBaseFromArgs } from "./lib/git";
import {
  readSourceConfig,
  scannedFiles,
  type SourceConfig,
} from "./lib/source-files";

// test-all.sh's discovery rule, which is bun's.
const BUN_TEST_FILE = /[._](test|spec)\.(js|ts|jsx|tsx)$/;
// Also `-test` and `-spec`, so e2e suites aren't reported as untested source.
const TEST_FILE = /[._-](test|spec)\.(js|ts|jsx|tsx)$/;

// Mostly loaded by other packages' tests, so a change here runs them all.
const SHARED_PACKAGES = new Set(["common", "shared", "sharedweb"]);

function testPackages(repoRoot: string): string[] {
  const testAll = fs.readFileSync(
    path.join(repoRoot, "scripts/test-all.sh"),
    "utf8",
  );
  const list = /^PACKAGES=\((.*)\)$/m.exec(testAll);
  if (!list) throw new Error("no PACKAGES=(...) line in scripts/test-all.sh");
  return list[1].split(/\s+/);
}

function changedLines({
  repoRoot,
  baseCommit,
  config,
}: {
  repoRoot: string;
  baseCommit: string;
  config: SourceConfig;
}): Map<string, Set<number>> {
  const diff = git({
    repoRoot,
    args: [
      "-c",
      "core.quotePath=false",
      "diff",
      "-U0",
      "--no-color",
      "--no-ext-diff",
      "--src-prefix=a/",
      "--dst-prefix=b/",
      baseCommit,
      "--",
      ...config.path,
    ],
  });
  const changed = parseAddedLines(diff.toString("utf8"));
  const untracked = git({
    repoRoot,
    args: [
      "ls-files",
      "-z",
      "--others",
      "--exclude-standard",
      "--",
      ...config.path,
    ],
  });
  for (const file of scannedFiles(
    config,
    untracked.toString("utf8").split("\0").filter(Boolean),
  )) {
    const count = fs
      .readFileSync(path.join(repoRoot, file), "utf8")
      .split("\n").length;
    changed.set(file, new Set(Array.from({ length: count }, (_, i) => i + 1)));
  }
  return changed;
}

function hasTests(repoRoot: string, pkg: string): boolean {
  return git({
    repoRoot,
    args: [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      pkg,
    ],
  })
    .toString("utf8")
    .split("\0")
    .some((file) => BUN_TEST_FILE.test(file));
}

function runTests({
  repoRoot,
  pkg,
  outDir,
}: {
  repoRoot: string;
  pkg: string;
  outDir: string;
}): { coverage: Map<string, Map<number, number>>; failures: string[] } {
  const coverageDir = path.join(outDir, pkg);
  console.error(`covercheck: running unit tests in ${pkg}…`);
  const run = spawnSync(
    "bun",
    [
      "test",
      "--coverage",
      "--coverage-reporter=lcov",
      "--coverage-dir",
      coverageDir,
    ],
    { cwd: path.join(repoRoot, pkg), encoding: "utf8", maxBuffer: 1 << 30 },
  );
  const output = `${run.stderr}${run.stdout}`;
  const failures = testFailures({ output, status: run.status });
  const lcovFile = path.join(coverageDir, "lcov.info");
  if (!fs.existsSync(lcovFile)) {
    // Bun writes no report when the tests ran without loading a source file.
    if (run.status !== null && !run.error) {
      return { coverage: new Map(), failures };
    }
    throw new Error(
      `bun test in ${pkg} did not run\n${run.error ?? output.slice(-2000)}`,
    );
  }
  const coverage = new Map<string, Map<number, number>>();
  for (const [file, hits] of parseLcov(fs.readFileSync(lcovFile, "utf8"))) {
    coverage.set(
      path.relative(repoRoot, path.resolve(repoRoot, pkg, file)),
      hits,
    );
  }
  return { coverage, failures };
}

function main(): void {
  const { base, repoRoot, baseCommit } = mergeBaseFromArgs();
  const config = readSourceConfig(repoRoot);
  const packages = testPackages(repoRoot);
  const owner = (file: string) =>
    packages
      .filter((pkg) => file.startsWith(`${pkg}/`))
      .sort((a, b) => b.length - a.length)[0];

  const changed = changedLines({ repoRoot, baseCommit, config });
  const files = scannedFiles(config, [...changed.keys()])
    .filter(
      (file) => !TEST_FILE.test(file) && (changed.get(file)?.size ?? 0) > 0,
    )
    .sort();
  if (files.length === 0) {
    console.log(`covercheck: no changed source files against ${base}`);
    return;
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "covercheck-"));
  const coverage = new Map<string, Map<number, number>>();
  const failures = new Map<string, string[]>();
  const owners = new Set(files.map(owner));
  const runs = [...owners].some((pkg) => pkg && SHARED_PACKAGES.has(pkg))
    ? packages
    : owners;
  try {
    for (const pkg of runs) {
      if (!pkg || !hasTests(repoRoot, pkg)) continue;
      const run = runTests({ repoRoot, pkg, outDir });
      for (const [file, hits] of run.coverage) {
        const merged = coverage.get(file) ?? new Map<number, number>();
        for (const [line, count] of hits) {
          merged.set(line, (merged.get(line) ?? 0) + count);
        }
        coverage.set(file, merged);
      }
      if (run.failures.length > 0) failures.set(pkg, run.failures);
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  let executable = 0;
  const missed = new Map<string, number[]>();
  const unloaded: string[] = [];
  for (const file of files) {
    const hits = coverage.get(file);
    if (!hits) {
      unloaded.push(file);
      continue;
    }
    const lines = [...(changed.get(file) ?? [])].filter((l) => hits.has(l));
    executable += lines.length;
    const unrun = lines.filter((l) => hits.get(l) === 0);
    if (unrun.length > 0) missed.set(file, unrun);
  }
  const unrunCount = [...missed.values()].reduce((n, l) => n + l.length, 0);

  for (const [pkg, names] of failures) {
    console.log(
      `covercheck: tests failed in ${pkg}; counts below still include what ran`,
    );
    for (const name of names) console.log(`  ${name}`);
  }
  console.log(
    `covercheck: ${executable - unrunCount} of ${executable} changed executable line(s) ran under unit tests, against ${base}`,
  );
  for (const [file, lines] of missed) {
    console.log(`  ${file}: ${lineRanges(lines)} never ran`);
  }
  if (unloaded.length > 0) {
    console.log(
      `covercheck: ${unloaded.length} changed file(s) no unit test loads`,
    );
    for (const file of unloaded) console.log(`  ${file}`);
  }
  console.log(
    "A reminder, not a gate: bun counts lines approximately, a line that ran may go unasserted, code a test reaches only through a subprocess or a file holding only types counts as never loaded, and `test:e2e` suites don't run here. Some code is fine untested; add a test where one would catch a regression you'd care about.",
  );
}

try {
  main();
} catch (error) {
  console.error(`covercheck: ${error}`);
  process.exitCode = 2;
}
