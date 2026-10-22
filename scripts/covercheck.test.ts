import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureGit } from "./lib/fixture-git";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(scriptDir, "covercheck.ts");
const fixtureRoot = path.join(scriptDir, ".tmp-test", "covercheck");

const MATH = `export function used(x: number): number {
  const doubled = x * 2;
  return doubled + 1;
}
`;
const UNUSED = `
export function unused(x: number): number {
  const tripled = x * 3;
  return tripled - 1;
}
`;
const MATH_TEST = `import { used } from "./math";
test("used", () => {
  expect(used(1)).toBe(3);
});
`;

let sandbox = "";

beforeEach(() => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  sandbox = fs.mkdtempSync(path.join(fixtureRoot, "repo-"));
  write(
    ".jscpd.json",
    JSON.stringify({ path: ["pkg", "untested"], ignore: ["**/*.gen.ts"] }),
  );
  write("scripts/test-all.sh", "PACKAGES=(pkg untested)\n");
  write("pkg/math.ts", MATH);
  write("pkg/math.test.ts", MATH_TEST);
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

test("reports nothing to check when no source changed", () => {
  write("pkg/math.test.ts", `${MATH_TEST}// touched\n`);
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toContain("no changed source files");
});

test("names changed lines no test runs", () => {
  write("pkg/math.ts", MATH + UNUSED);
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toMatch(/pkg\/math\.ts: [\d, -]+ never ran/);
  expect(output).not.toContain("of 0 changed");
});

test("reads the diff regardless of the user's prefix config", () => {
  git("config", "diff.mnemonicPrefix", "true");
  git("config", "diff.noprefix", "true");
  write("pkg/math.ts", MATH + UNUSED);
  expect(runCheck().output).toMatch(/pkg\/math\.ts: [\d, -]+ never ran/);
});

test("counts changed lines a test runs as covered", () => {
  write("pkg/math.ts", MATH.replace("x * 2", "x + x"));
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toMatch(/([1-9]\d*) of \1 changed/);
  expect(output).not.toContain("never ran");
});

test("names an untracked file no test loads", () => {
  write("pkg/other.ts", UNUSED);
  expect(runCheck().output).toContain("no unit test loads\n  pkg/other.ts");
});

test("names a changed file in a package without tests", () => {
  write("untested/lib.ts", UNUSED);
  expect(runCheck().output).toContain("no unit test loads\n  untested/lib.ts");
});

test("runs every package's tests when a shared package changes", () => {
  write(".jscpd.json", JSON.stringify({ path: ["pkg", "common"] }));
  write("scripts/test-all.sh", "PACKAGES=(pkg common)\n");
  write("common/math.ts", MATH);
  write("pkg/math.test.ts", MATH_TEST.replace("./math", "../common/math"));
  const { output } = runCheck();
  expect(output).not.toContain("no unit test loads");
  expect(output).not.toContain("of 0 changed");
});

test("reports when a package's tests load no source", () => {
  write(".jscpd.json", JSON.stringify({ path: ["pkg", "common"] }));
  write("scripts/test-all.sh", "PACKAGES=(pkg common probe)\n");
  write("probe/probe.test.ts", 'test("probe", () => expect(1).toBe(1));\n');
  write("common/lib.ts", UNUSED);
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toContain("no unit test loads\n  common/lib.ts");
});

test("lists failures in a package whose tests load no source", () => {
  write(".jscpd.json", JSON.stringify({ path: ["pkg", "common"] }));
  write("scripts/test-all.sh", "PACKAGES=(pkg common probe)\n");
  write("probe/probe.test.ts", 'test("probe", () => expect(1).toBe(2));\n');
  write("common/lib.ts", UNUSED);
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toContain("tests failed in probe");
  expect(output).toContain("(fail) probe");
  expect(output).toContain("no unit test loads\n  common/lib.ts");
});

test("lists import failures in a package whose tests load no source", () => {
  write(".jscpd.json", JSON.stringify({ path: ["pkg", "common"] }));
  write("scripts/test-all.sh", "PACKAGES=(pkg common probe)\n");
  write("probe/broken.test.ts", 'import "./missing";\n');
  write("common/lib.ts", UNUSED);
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toContain("tests failed in probe");
  expect(output).toContain("no unit test loads\n  common/lib.ts");
});

test("names a changed file outside every tested package", () => {
  write(".jscpd.json", JSON.stringify({ path: ["pkg", "citesting"] }));
  write("citesting/lib.ts", UNUSED);
  expect(runCheck().output).toContain("no unit test loads\n  citesting/lib.ts");
});

test("skips a file that only lost lines", () => {
  write("untested/lib.ts", UNUSED);
  git("add", "-A");
  git("commit", "-qm", "untested");
  write("untested/lib.ts", UNUSED.replace("  const tripled = x * 3;\n", ""));
  expect(runCheck().output).toContain("no changed source files");
});

test("counts a line run by one package's tests and only loaded by another's", () => {
  write(".jscpd.json", JSON.stringify({ path: ["pkg", "common"] }));
  write("scripts/test-all.sh", "PACKAGES=(pkg other common)\n");
  write("common/math.ts", MATH);
  write("pkg/math.test.ts", MATH_TEST.replace("./math", "../common/math"));
  write(
    "other/load.test.ts",
    'import "../common/math";\ntest("load", () => expect(1).toBe(1));\n',
  );
  const { output } = runCheck();
  expect(output).toMatch(/([1-9]\d*) of \1 changed/);
  expect(output).not.toContain("never ran");
});

test("skips a package whose only tests are e2e suites", () => {
  write("untested/app.e2e-spec.ts", 'test("e2e", () => expect(1).toBe(1));\n');
  write("untested/lib.ts", UNUSED);
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toContain("no unit test loads\n  untested/lib.ts");
});

test("ignores an untracked symlink to a directory", () => {
  write("pkg/other.ts", UNUSED);
  fs.symlinkSync("../pkg", path.join(sandbox, "untested"));
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toContain("no unit test loads\n  pkg/other.ts");
});

test("skips files the config ignores", () => {
  write("pkg/client.gen.ts", UNUSED);
  expect(runCheck().output).toContain("no changed source files");
});

test("lists failing tests and still reports coverage", () => {
  write("pkg/math.ts", MATH + UNUSED);
  write("pkg/math.test.ts", MATH_TEST.replace("toBe(3)", "toBe(4)"));
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toContain("tests failed in pkg");
  expect(output).toContain("(fail) used");
  expect(output).toContain("never ran");
});

test("names a test file that fails to import", () => {
  write("pkg/math.ts", MATH + UNUSED);
  write("pkg/broken.test.ts", 'import "./missing";\n');
  const { status, output } = runCheck();
  expect(status).toBe(0);
  expect(output).toContain("tests failed in pkg");
  expect(output).toMatch(/error: .*\.\/missing/);
});

test("fails loudly on an unknown base ref", () => {
  expect(runCheck("no-such-ref")).toMatchObject({ status: 2 });
});
