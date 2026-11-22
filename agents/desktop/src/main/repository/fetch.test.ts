import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../common/src/result";
import { fetchMain } from "./fetch";
import { type Git, gitAt } from "./git";
import type { RepositorySource } from "./source";
import { git, makeSource } from "./testing/fixture";

let dir: string;
let source: RepositorySource;
let checkout: string;
const realGit = gitAt({ executable: "git", env: process.env });

beforeEach(() => {
  dir = realpathSync(mkdtempSync(path.join(tmpdir(), "fetch-")));
  source = makeSource({
    folder: path.join(dir, "source"),
    defaultFolder: path.join(dir, "alliance"),
  });
  checkout = source.defaultFolder;
  git(dir, "clone", "-q", source.url, checkout);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("returns the commit of the main it fetched", async () => {
  expect(
    await fetchMain({
      git: realGit,
      checkout,
      url: source.url,
      signal: new AbortController().signal,
    }),
  ).toEqual(R.success(source.minimumCommit));
});

test("a caller cancelled before its fetch starts runs no git fetch", async () => {
  let fetches = 0;
  const countingGit: Git = {
    ...realGit,
    run: (input) => {
      if (input.args.includes("fetch")) fetches++;
      return realGit.run(input);
    },
  };
  const fetched = await fetchMain({
    git: countingGit,
    checkout,
    url: source.url,
    signal: AbortSignal.abort(),
  });
  expect(fetched.ok).toBe(false);
  expect(fetches).toBe(0);
});
