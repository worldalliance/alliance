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

test("fetches run one at a time, even from different callers", async () => {
  let running = 0;
  let most = 0;
  const countingGit: Git = {
    ...realGit,
    run: async (input) => {
      if (!input.args.includes("fetch")) return realGit.run(input);
      most = Math.max(most, ++running);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const ran = await realGit.run(input);
      running--;
      return ran;
    },
  };
  const fetch = () =>
    fetchMain({
      git: countingGit,
      checkout,
      url: source.url,
      signal: new AbortController().signal,
    });
  const fetched = await Promise.all([fetch(), fetch()]);
  expect(most).toBe(1);
  expect(fetched.map((f) => f.ok && f.value)).toEqual([
    source.minimumCommit,
    source.minimumCommit,
  ]);
});

test("a caller cancelled while waiting for its turn stops waiting", async () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  const stalledGit: Git = {
    ...realGit,
    run: async (input) => {
      if (input.args.includes("fetch")) await held;
      return realGit.run(input);
    },
  };
  const fetch = (signal: AbortSignal) =>
    fetchMain({ git: stalledGit, checkout, url: source.url, signal });
  const first = fetch(new AbortController().signal);
  const controller = new AbortController();
  const second = fetch(controller.signal);
  controller.abort();
  expect((await second).ok).toBe(false);
  release();
  expect(await first).toEqual(R.success(source.minimumCommit));
});

test("a caller cancelled once its fetch has started resolves after git exits", async () => {
  let gitExited = false;
  const started = Promise.withResolvers<void>();
  const slowGit: Git = {
    ...realGit,
    run: async (input) => {
      if (!input.args.includes("fetch")) return realGit.run(input);
      started.resolve();
      await new Promise((resolve) =>
        input.signal?.addEventListener("abort", resolve, { once: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      gitExited = true;
      return R.failure(new Error("stopped"));
    },
  };
  const controller = new AbortController();
  const fetched = fetchMain({
    git: slowGit,
    checkout,
    url: source.url,
    signal: controller.signal,
  });
  await started.promise;
  controller.abort();
  expect((await fetched).ok).toBe(false);
  expect(gitExited).toBe(true);
});
