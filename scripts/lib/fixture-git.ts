import { spawnSync } from "node:child_process";

/** Runs git in a test fixture repo with a fixed identity and no hooks. */
export function fixtureGit(cwd: string, ...args: string[]): void {
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
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
}
