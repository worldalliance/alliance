import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureGit } from "./lib/fixture-git";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(scriptDir, "dupcheck.ts");
const fixtureRoot = path.join(scriptDir, ".tmp-test", "dupcheck");

const block = (name: string) =>
  Array.from(
    { length: 12 },
    (_, i) =>
      `export function ${name}${i}(items: number[]): number {\n  return items.filter((item) => item > ${i}).reduce((sum, item) => sum + item * ${i}, 0);\n}\n`,
  ).join("");

let sandbox = "";

beforeEach(() => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  sandbox = fs.mkdtempSync(path.join(fixtureRoot, "repo-"));
  write(
    ".jscpd.json",
    JSON.stringify({ path: ["src"], minTokens: 50, minLines: 10 }),
  );
  write("src/original.ts", block("sum"));
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "base");
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function git(...args: string[]): void {
  fixtureGit(sandbox, ...args);
}

function write(relativePath: string, contents: string): void {
  const file = path.join(sandbox, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function runCheck(base = "main"): { status: number; output: string } {
  const result = spawnSync("bun", [script, "--base", base], {
    cwd: sandbox,
    encoding: "utf8",
  });
  return {
    status: result.status ?? -1,
    output: `${result.stdout}${result.stderr}`,
  };
}

const NONE = "no new duplicated code";
const SENTENCE = "Couldn't load the people you can message.";

test("reports nothing when nothing is copied", () => {
  write("src/other.ts", "export const answer = 42;\n");
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toContain(NONE);
});

test("reports an uncommitted copy and names both locations", () => {
  write("src/copy.ts", block("sum"));
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).not.toContain(NONE);
  expect(output).toContain("src/copy.ts:");
  expect(output).toContain("src/original.ts:");
});

test("ignores duplication the base ref already has", () => {
  write("src/copy.ts", block("sum"));
  git("add", "-A");
  git("commit", "-qm", "copy");
  git("branch", "-f", "base-with-copy");
  expect(runCheck("base-with-copy").output).toContain(NONE);
});

test("reads non-ASCII files at the base without shifting later ones", () => {
  const curly = "’".repeat(50);
  write("src/a.ts", `export const a = "${curly}";\n`);
  write("src/b.ts", `export const b = "${curly}";\n`);
  write("src/c.ts", `export const c = "${SENTENCE}";\n`);
  write("src/d.ts", `export const d = "${SENTENCE}";\n`);
  git("add", "-A");
  git("commit", "-qm", "repeats");
  expect(runCheck().output).toContain(NONE);
});

test("names a new copy of code the base already duplicates", () => {
  write("src/copy.ts", block("sum"));
  git("add", "-A");
  git("commit", "-qm", "copy");
  write("src/copy2.ts", block("sum"));
  expect(runCheck().output).toContain("src/copy2.ts:");
});

test("skips a copy wrapped in ignore comments", () => {
  write(
    "src/copy.ts",
    `// jscpd:ignore-start\n${block("sum")}// jscpd:ignore-end\n`,
  );
  expect(runCheck().output).toContain(NONE);
});

test("fails loudly on an unknown base ref", () => {
  expect(runCheck("no-such-ref")).toMatchObject({ status: 2 });
});

test("compares against the merge-base, not a base that moved on", () => {
  write("src/copy.ts", block("sum"));
  git("add", "-A");
  git("commit", "-qm", "copy");
  git("branch", "feature");
  git("rm", "-q", "src/copy.ts");
  git("commit", "-qm", "dedup on main");
  git("checkout", "-q", "feature");
  expect(runCheck().output).toContain(NONE);
});

test("fails loudly when the config matches no files", () => {
  write(".jscpd.json", JSON.stringify({ path: ["src"], format: ["python"] }));
  expect(runCheck()).toMatchObject({ status: 2 });
});

test("reports a sentence repeated in an uncommitted file", () => {
  write("src/a.ts", `export const a = "${SENTENCE}";\n`);
  git("add", "-A");
  git("commit", "-qm", "a");
  write("src/b.ts", `export const b = "${SENTENCE}";\n`);
  const { output } = runCheck();
  expect(output).toContain(SENTENCE);
  expect(output).toContain("src/a.ts:1");
  expect(output).toContain("src/b.ts:1");
});

test("skips code and text in files the config ignores", () => {
  write(
    ".jscpd.json",
    JSON.stringify({
      path: ["src"],
      minTokens: 50,
      minLines: 10,
      ignore: ["**/*.test.*"],
    }),
  );
  write("src/a.ts", `export const a = "${SENTENCE}";\n`);
  git("add", "-A");
  git("commit", "-qm", "a");
  write("src/a.test.ts", `${block("sum")}export const b = "${SENTENCE}";\n`);
  expect(runCheck().output).toContain(NONE);
});

test("reports code and text copied in a commit on the branch", () => {
  write("src/a.ts", `export const a = "${SENTENCE}";\n`);
  git("add", "-A");
  git("commit", "-qm", "a");
  git("checkout", "-qb", "feature");
  write("src/copy.ts", block("sum"));
  write("src/b.ts", `export const b = "${SENTENCE}";\n`);
  git("add", "-A");
  git("commit", "-qm", "copies");
  const { output } = runCheck();
  expect(output).toContain("src/copy.ts:");
  expect(output).toContain("src/b.ts:1");
});

test("exits 2 on a malformed config", () => {
  write(".jscpd.json", JSON.stringify({ path: "src" }));
  expect(runCheck()).toMatchObject({ status: 2 });
});
