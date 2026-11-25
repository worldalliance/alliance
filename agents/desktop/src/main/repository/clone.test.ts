import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ClonePhase } from "../../shared/repository";
import { cloneInto, type CloneProgress, lastProgress } from "./clone";
import { gitAt } from "./git";
import type { RepositorySource } from "./source";
import { git, makeSource } from "./testing/fixture";

let dir: string;
let source: RepositorySource;
const gitCli = gitAt({ executable: "git", env: process.env });

beforeEach(() => {
  dir = realpathSync(mkdtempSync(path.join(tmpdir(), "clone-")));
  source = makeSource({
    folder: path.join(dir, "source"),
    defaultFolder: path.join(dir, "workspaces", "alliance"),
  });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const clone = (params: {
  url?: string;
  folder?: string;
  signal?: AbortSignal;
  onProgress?: (progress: CloneProgress) => void;
}) =>
  cloneInto({
    git: gitCli,
    url: params.url ?? source.url,
    folder: params.folder ?? source.defaultFolder,
    signal: params.signal ?? new AbortController().signal,
    onProgress: params.onProgress ?? (() => undefined),
  });

const workspaces = () => readdirSync(path.join(dir, "workspaces"));

describe("lastProgress", () => {
  test("reads the latest phase and percentage, across carriage returns", () => {
    expect(
      lastProgress(
        "Cloning into '.x'...\nReceiving objects:  12% (1/9)\rReceiving objects:  45% (4/9), 1.00 MiB | 2 MiB/s\r",
      ),
    ).toEqual({ phase: ClonePhase.Downloading, percent: 45 });
    expect(lastProgress("Resolving deltas: 100% (3/3), done.\n")).toEqual({
      phase: ClonePhase.Unpacking,
      percent: 100,
    });
    expect(lastProgress("Cloning into '.x'...\n")).toBeUndefined();
  });
});

describe("cloneInto", () => {
  test("clones into a missing folder, creating its parents, and leaves nothing else beside it", async () => {
    expect(await clone({})).toEqual({ ok: true, value: undefined });
    expect(git(source.defaultFolder, "rev-parse", "HEAD")).toBe(
      source.minimumCommit,
    );
    expect(workspaces()).toEqual(["alliance"]);
  });

  test("clones into an empty folder", async () => {
    mkdirSync(source.defaultFolder, { recursive: true });
    expect((await clone({})).ok).toBe(true);
    expect(existsSync(path.join(source.defaultFolder, "README.md"))).toBe(true);
  });

  test("refuses a folder with files in it, and leaves them", async () => {
    mkdirSync(source.defaultFolder, { recursive: true });
    writeFileSync(path.join(source.defaultFolder, "notes.txt"), "mine");
    const refused = await clone({});
    expect(!refused.ok && refused.error.message).toContain(
      "already has files in it",
    );
    expect(readdirSync(source.defaultFolder)).toEqual(["notes.txt"]);
  });

  test("a failed clone says so with git's output and leaves no partial folder", async () => {
    const failed = await clone({ url: path.join(dir, "nowhere") });
    expect(!failed.ok && failed.error.message).toContain(
      "couldn't clone the repository",
    );
    expect(!failed.ok && failed.error.details).toContain("git clone exited");
    expect(workspaces()).toEqual([]);
  });

  test("a cancelled clone leaves no partial folder", async () => {
    const controller = new AbortController();
    controller.abort();
    expect((await clone({ signal: controller.signal })).ok).toBe(false);
    expect(workspaces()).toEqual([]);
  });

  test("sweeps a partial folder an earlier clone left", async () => {
    const stale = path.join(dir, "workspaces", ".alliance.cloning-stale");
    mkdirSync(stale, { recursive: true });
    writeFileSync(path.join(stale, "half"), "");
    expect((await clone({})).ok).toBe(true);
    expect(workspaces()).toEqual(["alliance"]);
  });
});
