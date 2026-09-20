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
function runCheck(): { status: number; output: string } {
  const copy = path.join(sandbox, "scripts", "check-gitignore.sh");
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.copyFileSync(script, copy);
  fs.chmodSync(copy, 0o755);

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
