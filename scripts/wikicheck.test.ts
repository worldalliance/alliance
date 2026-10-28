import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureGit } from "./lib/fixture-git";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(scriptDir, "wikicheck.ts");
const fixtureRoot = path.join(scriptDir, ".tmp-test", "wikicheck");
const RECORD = "01a00000-0000-7000-8000-000000000001-sample";

let sandbox = "";

beforeEach(() => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  sandbox = fs.mkdtempSync(path.join(fixtureRoot, "repo-"));
  fixtureGit(sandbox, "init", "-q");
  write(".gitignore", ".DS_Store\n");
  write("docs/wiki/index.md", "# Wiki\n");
  write(
    "docs/wiki/coverage.md",
    `# Coverage

| Record | Disposition | Topics | Notes |
| --- | --- | --- | --- |
| [r](../provenance/${RECORD}/) | pending | | |
`,
  );
  write(`docs/provenance/${RECORD}/REQUIREMENTS.md`, "# Sample\n");
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function write(relativePath: string, contents: string): void {
  const file = path.join(sandbox, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function runCheck(): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("bun", [script, sandbox], { encoding: "utf8" });
  return {
    status: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

test("passes a consistent checkout", () => {
  const { status, stdout } = runCheck();
  expect(status).toBe(0);
  expect(stdout).toContain("2 wiki page(s) and 1 provenance record(s) pass");
});

test("a link whose case differs from the file is broken, as on GitHub", () => {
  write("docs/wiki/index.md", "# Wiki\n\nSee [c](Coverage.md).\n");
  const { status, stderr } = runCheck();
  expect(status).toBe(1);
  expect(stderr).toContain(
    "docs/wiki/index.md:3:5: broken link: docs/wiki/Coverage.md does not exist",
  );
});

test("a link through a file is broken rather than a crash", () => {
  write("docs/wiki/index.md", "# Wiki\n\nSee [x](coverage.md/x).\n");
  const { status, stderr } = runCheck();
  expect(status).toBe(1);
  expect(stderr).toContain(
    "docs/wiki/index.md:3:5: broken link: docs/wiki/coverage.md/x does not exist",
  );
});

test("files git ignores don't count, as in CI's checkout", () => {
  write(
    "docs/provenance/01a00000-0000-7000-8000-00000000000f-gone/.DS_Store",
    "",
  );
  write("docs/wiki/index.md", "# Wiki\n\nSee [x](.DS_Store).\n");
  write("docs/wiki/.DS_Store", "");
  const { status, stderr } = runCheck();
  expect(status).toBe(1);
  expect(stderr.trim().split("\n")).toEqual([
    "docs/wiki/index.md:3:5: broken link: docs/wiki/.DS_Store does not exist",
    "wikicheck: 1 problem(s)",
  ]);
});

test("a tracked file deleted from the working tree is gone", () => {
  write("docs/wiki/gone.md", "# Gone\n");
  fixtureGit(sandbox, "add", "-A");
  fixtureGit(sandbox, "commit", "-qm", "base");
  fs.rmSync(path.join(sandbox, "docs/wiki/gone.md"));
  const { status, stdout } = runCheck();
  expect(status).toBe(0);
  expect(stdout).toContain("2 wiki page(s) and 1 provenance record(s) pass");
});

test("a symlink to a directory is not a file to read", () => {
  fs.symlinkSync("../provenance", path.join(sandbox, "docs/wiki/linked"));
  write("docs/wiki/index.md", "# Wiki\n\nSee [x](linked#L1).\n");
  const { status, stderr } = runCheck();
  expect(status).toBe(1);
  expect(stderr).toContain(
    "docs/wiki/index.md:3:5: broken link: docs/wiki/linked does not exist",
  );
});

test("fails with the file, line, and column of each problem", () => {
  write("docs/wiki/index.md", "# Wiki\n\nSee [gone](gone.md).\n");
  write(
    "docs/provenance/01a00000-0000-7000-8000-000000000002-new/DECISIONS.md",
    "# New\n",
  );
  const { status, stderr } = runCheck();
  expect(status).toBe(1);
  expect(stderr.trim().split("\n")).toEqual([
    "docs/wiki/index.md:3:5: broken link: docs/wiki/gone.md does not exist",
    "docs/wiki/coverage.md:1:1: docs/provenance/01a00000-0000-7000-8000-000000000002-new has no coverage row",
    "wikicheck: 2 problem(s)",
  ]);
});
