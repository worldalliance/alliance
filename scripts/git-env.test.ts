import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureGit } from "./lib/fixture-git";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const fixtureRoot = path.join(scriptDir, ".tmp-test", "git-env");

let sandbox = "";
let outer = "";
let pkg = "";
let outerHead = "";

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function fixtureTest(name: string): string {
  const fixture = JSON.stringify(path.join(sandbox, `fixture-${name}`));
  return `import { mkdirSync } from "node:fs";
import { fixtureGit } from ${JSON.stringify(path.join(scriptDir, "lib", "fixture-git"))};
import { double } from "./math";
test("${name}", () => {
  mkdirSync(${fixture});
  fixtureGit(${fixture}, "init", "-q", "-b", "main");
  fixtureGit(${fixture}, "commit", "-q", "--allow-empty", "-m", "fixture");
  expect(double(1)).toBe(2);
});
`;
}

beforeEach(() => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  sandbox = fs.mkdtempSync(path.join(fixtureRoot, "run-"));
  outer = path.join(sandbox, "outer");
  pkg = path.join(outer, "pkg");
  write(path.join(outer, "scripts", "test-all.sh"), "PACKAGES=(pkg)\n");
  write(path.join(outer, ".jscpd.json"), JSON.stringify({ path: ["pkg"] }));
  write(
    path.join(pkg, "math.ts"),
    "export const double = (x: number) => x * 2;\n",
  );
  fixtureGit(outer, "init", "-q", "-b", "main");
  fixtureGit(outer, "add", "-A");
  fixtureGit(outer, "commit", "-q", "-m", "outer");
  outerHead = outerGit("rev-parse", "HEAD");

  write(path.join(pkg, "a.test.ts"), fixtureTest("a"));
  write(path.join(pkg, "b.test.ts"), fixtureTest("b"));
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function outerGit(...args: string[]): string {
  return spawnSync("git", args, { cwd: outer, encoding: "utf8" }).stdout.trim();
}

function runWithGitDir(command: string[], cwd: string) {
  return spawnSync(command[0], command.slice(1), {
    cwd,
    env: { ...process.env, GIT_DIR: path.join(outer, ".git") },
    encoding: "utf8",
  });
}

function expectOuterUntouched(): void {
  expect(outerGit("config", "core.bare")).toBe("false");
  expect(outerGit("rev-parse", "HEAD")).toBe(outerHead);
}

test.each([[[]], [["--coverage"]]])(
  "bun test %p refuses to run any test with GIT_DIR set",
  (flags: string[]) => {
    const run = runWithGitDir(["bun", "test", ...flags], pkg);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("GIT_DIR");
    expect(fs.existsSync(path.join(sandbox, "fixture-a"))).toBe(false);
    expect(fs.existsSync(path.join(sandbox, "fixture-b"))).toBe(false);
    expectOuterUntouched();
  },
);

test.each([
  ["scripts/", scriptDir],
  ["the repo root", repoRoot],
])(
  "bun test from %s refuses a test that runs git without fixture-git",
  (_where: string, cwd: string) => {
    const fixture = path.join(sandbox, "fixture-raw");
    const raw = path.join(sandbox, "raw.test.ts");
    write(
      raw,
      `import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
test("raw", () => {
  mkdirSync(${JSON.stringify(fixture)});
  spawnSync("git", ["init", "-q"], { cwd: ${JSON.stringify(fixture)} });
});
`,
    );
    const run = runWithGitDir(["bun", "test", raw], cwd);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("GIT_DIR");
    expect(fs.existsSync(fixture)).toBe(false);
    expectOuterUntouched();
  },
);

test("test-all.sh unsets GIT_DIR before running tests", () => {
  const run = runWithGitDir(
    ["bash", "scripts/test-all.sh", path.relative(repoRoot, pkg)],
    repoRoot,
  );
  expect({ status: run.status, output: run.stdout + run.stderr }).toMatchObject(
    {
      status: 0,
    },
  );
  expect(fs.existsSync(path.join(sandbox, "fixture-a"))).toBe(true);
  expectOuterUntouched();
});

test("covercheck unsets GIT_DIR before running tests", () => {
  fs.appendFileSync(
    path.join(pkg, "math.ts"),
    "export const triple = (x: number) => x * 3;\n",
  );
  const run = runWithGitDir(
    ["bun", path.join(scriptDir, "covercheck.ts"), "--base", "main"],
    outer,
  );
  expect({ status: run.status, output: run.stdout + run.stderr }).toMatchObject(
    {
      status: 0,
    },
  );
  expect(run.stdout + run.stderr).not.toContain("bun test exited");
  expect(fs.existsSync(path.join(sandbox, "fixture-a"))).toBe(true);
  expectOuterUntouched();
});
