import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(scriptDir, "check-gitignore.sh");
const fixtureRoot = path.join(scriptDir, ".tmp-test", "check-gitignore");

let sandbox = "";

beforeEach(() => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  sandbox = fs.mkdtempSync(path.join(fixtureRoot, "repo-"));
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function git(...args: string[]): void {
  const identity = [
    "-c",
    "user.email=test@example.com",
    "-c",
    "user.name=test",
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=/dev/null",
  ];
  const result = spawnSync("git", [...identity, ...args], {
    cwd: sandbox,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
}

function write(relativePath: string, contents: string): void {
  const file = path.join(sandbox, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

// The .gitignore lands in a second commit: with the rule already in place,
// `git add -A` would skip the file and leave the check nothing to find.
function commitThenIgnore({
  trackedPath,
  ignoreRules,
  ignorePath = ".gitignore",
}: {
  trackedPath: string;
  ignoreRules: string;
  ignorePath?: string;
}): void {
  write(trackedPath, "contents\n");
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "track a file");
  write(ignorePath, ignoreRules);
  git("add", "-A");
  git("commit", "-qm", "add ignore rules");
}

// The script picks the repo it checks from its own location, so the copy under
// test has to sit inside the fixture repo.
function runCheck(anyDepth = ""): { status: number; output: string } {
  const copy = path.join(sandbox, "scripts", "check-gitignore.sh");
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.copyFileSync(script, copy);
  fs.chmodSync(copy, 0o755);
  write("scripts/gitignore-any-depth.txt", anyDepth);

  const result = spawnSync(copy, { cwd: sandbox, encoding: "utf8" });
  return {
    status: result.status ?? -1,
    output: `${result.stdout}${result.stderr}`,
  };
}

describe("check-gitignore.sh", () => {
  it("passes when no ignore rule matches a tracked file", () => {
    commitThenIgnore({ trackedPath: "src/keep.txt", ignoreRules: "/build/\n" });

    expect(runCheck().status).toBe(0);
  });

  it("fails and names the file when an ignore rule matches a tracked file", () => {
    commitThenIgnore({
      trackedPath: "sub/tracked.txt",
      ignoreRules: "/sub/\n",
    });

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain("sub/tracked.txt");
  });

  it("fails and names the file when a nested .gitignore matches a tracked file", () => {
    write(".gitignore", "");
    commitThenIgnore({
      trackedPath: "a/b/c.txt",
      ignoreRules: "/b/c.txt\n",
      ignorePath: "a/.gitignore",
    });

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain("a/b/c.txt");
  });

  it("passes when only a personal exclude matches a tracked file", () => {
    commitThenIgnore({
      trackedPath: "sub/tracked.txt",
      ignoreRules: "/build/\n",
    });
    write(".git/info/exclude", "/sub/\n");

    expect(runCheck().status).toBe(0);
  });
});

describe("check-gitignore.sh directory rules", () => {
  it.each([
    "build/\n",
    "**/build/\n",
    "**/a/b/\n",
    "**/build/**\n",
    "**/build/*\n",
    "/**/build/\n",
    "**/\n",
    "/**/\n",
    "build/  \n",
    "build/\r\n",
  ])("fails on the unanchored rule %j", (ignoreRules) => {
    commitThenIgnore({ trackedPath: "src/keep.txt", ignoreRules });

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain(`.gitignore:1:${ignoreRules.trimEnd()}\n`);
  });

  it("fails and names the file when a .gitignore two levels down has an unanchored rule", () => {
    write(".gitignore", "");
    commitThenIgnore({
      trackedPath: "src/keep.txt",
      ignoreRules: "build/\n",
      ignorePath: "a/b/.gitignore",
    });

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain("a/b/.gitignore:1:build/");
  });

  it("fails on an unanchored rule in a .gitignore whose path git quotes", () => {
    write(".gitignore", "");
    commitThenIgnore({
      trackedPath: "src/keep.txt",
      ignoreRules: "build/\n",
      ignorePath: "café/.gitignore",
    });

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain("café/.gitignore:1:build/");
  });

  it("fails on an unanchored rule in a .gitignore not yet staged", () => {
    commitThenIgnore({ trackedPath: "src/keep.txt", ignoreRules: "/build/\n" });
    write("a/.gitignore", "build/\n");

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain("a/.gitignore:1:build/");
  });

  it("fails and names the file when a .gitignore cannot be read", () => {
    commitThenIgnore({ trackedPath: "src/keep.txt", ignoreRules: "/build/\n" });
    fs.chmodSync(path.join(sandbox, ".gitignore"), 0o000);

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain("Cannot read .gitignore");
  });

  it("passes without an error on a tracked .gitignore deleted from the worktree", () => {
    write(".gitignore", "");
    commitThenIgnore({
      trackedPath: "src/keep.txt",
      ignoreRules: "/build/\n",
      ignorePath: "a/.gitignore",
    });
    fs.rmSync(path.join(sandbox, "a/.gitignore"));

    const { status, output } = runCheck();
    expect(status).toBe(0);
    expect(output).not.toContain("a/.gitignore");
  });

  it.each([
    "/build/\n",
    "some/where/\n",
    "a/**/b/\n",
    "**/notes.md\n",
    "**/docs/notes.md\n",
    "!keep/\n",
    "# build/\n",
  ])("passes on %j", (ignoreRules) => {
    commitThenIgnore({ trackedPath: "src/keep.txt", ignoreRules });

    expect(runCheck().status).toBe(0);
  });

  it("passes on an unanchored rule listed in any_depth for that file", () => {
    commitThenIgnore({
      trackedPath: "src/keep.txt",
      ignoreRules: "uploads/\n",
    });

    const { status, output } = runCheck("# comment\n\n.gitignore:uploads/\n");
    expect(status).toBe(0);
    expect(output).toContain("anchored or listed in");
  });

  it("fails and names an any_depth entry that matches no rule", () => {
    commitThenIgnore({
      trackedPath: "src/keep.txt",
      ignoreRules: "/uploads/\n",
    });

    const { status, output } = runCheck(".gitignore:uploads/\n");
    expect(status).toBe(1);
    expect(output).toContain("match no rule:\n.gitignore:uploads/\n");
  });

  it("passes on an unanchored rule in a .gitignore a personal exclude hides", () => {
    commitThenIgnore({ trackedPath: "src/keep.txt", ignoreRules: "/build/\n" });
    write("vendor/.gitignore", "node_modules/\n");
    write(".git/info/exclude", "/vendor/\n");

    expect(runCheck().status).toBe(0);
  });

  it("fails on an any_depth rule written in a different .gitignore", () => {
    write(".gitignore", "");
    commitThenIgnore({
      trackedPath: "src/keep.txt",
      ignoreRules: "uploads/\n",
      ignorePath: "a/.gitignore",
    });

    const { status, output } = runCheck(".gitignore:uploads/\n");
    expect(status).toBe(1);
    expect(output).toContain("a/.gitignore:1:uploads/");
  });

  it("passes on a file that only ends in .gitignore", () => {
    commitThenIgnore({
      trackedPath: "src/keep.txt",
      ignoreRules: "build/\n",
      ignorePath: "node.gitignore",
    });

    expect(runCheck().status).toBe(0);
  });

  it("reports both checks in one run", () => {
    commitThenIgnore({ trackedPath: "build/x.txt", ignoreRules: "build/\n" });

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain("Tracked files matched by ignore rules:");
    expect(output).toContain(
      "Ignore rules that name a directory without anchoring it:",
    );
  });
});
