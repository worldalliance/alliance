import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gitEnvironment } from "../../git-environment";
import type { RepositorySource } from "../source";

const identity = [
  "-c",
  "user.name=Fixture",
  "-c",
  "user.email=fixture@example.com",
  "-c",
  "commit.gpgsign=false",
];

/** Runs git in folder, returning its trimmed stdout. */
export const git = (folder: string, ...args: string[]): string =>
  execFileSync("git", [...identity, "-C", folder, ...args], {
    encoding: "utf8",
    env: gitEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

export function commitFile(params: {
  folder: string;
  file: string;
  message: string;
}): string {
  const file = path.join(params.folder, params.file);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${params.message}\n`);
  git(params.folder, "add", params.file);
  git(params.folder, "commit", "-q", "-m", params.message);
  return git(params.folder, "rev-parse", "HEAD");
}

/** A repository standing in for the Alliance repository: a first commit, then the minimum one, on main. */
export function makeSource(params: {
  folder: string;
  defaultFolder: string;
}): RepositorySource {
  mkdirSync(params.folder, { recursive: true });
  git(params.folder, "init", "-q", "-b", "main");
  const firstCommit = commitFile({
    folder: params.folder,
    file: "README.md",
    message: "First",
  });
  const minimumCommit = commitFile({
    folder: params.folder,
    file: "scripts/list-worktrees.ts",
    message: "Minimum",
  });
  return {
    url: params.folder,
    firstCommit,
    minimumCommit,
    defaultFolder: params.defaultFolder,
  };
}
