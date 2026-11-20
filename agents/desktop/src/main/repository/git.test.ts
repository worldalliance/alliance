import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findGit, gitAt } from "./git";

let dir: string;
let fakeGit: string;
let xcodeSelectRan: string;
let developerFolder: string;

const script = (file: string, body: string) => {
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
};

const xcodeSelect = (params: { code: number; prints: string }) =>
  script(
    path.join(dir, "xcode-select"),
    `: > '${xcodeSelectRan}'; echo '${params.prints}'; exit ${params.code}`,
  );

const find = (params: {
  platform: NodeJS.Platform;
  xcodeSelectCode: number;
  developerFolder?: string;
}) =>
  findGit({
    env: { PATH: path.dirname(fakeGit) },
    platform: params.platform,
    appleStub: fakeGit,
    xcodeSelect: xcodeSelect({
      code: params.xcodeSelectCode,
      prints: params.developerFolder ?? developerFolder,
    }),
  });

beforeEach(() => {
  dir = realpathSync(mkdtempSync(path.join(tmpdir(), "git-")));
  mkdirSync(path.join(dir, "bin"));
  fakeGit = script(path.join(dir, "bin", "git"), "echo fake git");
  xcodeSelectRan = path.join(dir, "xcode-select-ran");
  developerFolder = path.join(dir, "developer");
  mkdirSync(path.join(developerFolder, "usr", "bin"), { recursive: true });
  script(path.join(developerFolder, "usr", "bin", "git"), "");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("findGit", () => {
  test("git missing from PATH says how to get it for the platform", async () => {
    const missing = (platform: NodeJS.Platform) =>
      findGit({ env: { PATH: path.join(dir, "empty") }, platform });
    expect(await missing("darwin")).toEqual({
      ok: false,
      error: expect.stringContaining("xcode-select --install"),
    });
    expect(await missing("linux")).toEqual({
      ok: false,
      error: "Alliance agent needs Git. Install it, then check again.",
    });
  });

  test("Apple's stub without developer tools counts as missing and isn't run", async () => {
    writeFileSync(fakeGit, `#!/bin/sh\n: > '${dir}/stub-ran'\n`);
    expect(await find({ platform: "darwin", xcodeSelectCode: 2 })).toEqual({
      ok: false,
      error: expect.stringContaining("xcode-select --install"),
    });
    expect(existsSync(xcodeSelectRan)).toBe(true);
    expect(existsSync(path.join(dir, "stub-ran"))).toBe(false);
  });

  test("Apple's stub with developer tools is used", async () => {
    const found = await find({ platform: "darwin", xcodeSelectCode: 0 });
    if (!found.ok) throw new Error(found.error);
    expect(await found.value.output(["--version"])).toEqual({
      ok: true,
      value: "fake git\n",
    });
  });

  test("Apple's stub counts as missing when xcode-select names a folder without git", async () => {
    const empty = path.join(dir, "empty-developer");
    mkdirSync(empty);
    expect(
      await find({
        platform: "darwin",
        xcodeSelectCode: 0,
        developerFolder: empty,
      }),
    ).toEqual({
      ok: false,
      error: expect.stringContaining("xcode-select --install"),
    });
  });

  test("off macOS, git at the stub's path runs without asking xcode-select", async () => {
    const found = await find({ platform: "linux", xcodeSelectCode: 2 });
    expect(found.ok).toBe(true);
    expect(existsSync(xcodeSelectRan)).toBe(false);
  });
});

describe("gitAt", () => {
  test("runs git in English, without prompts, optional locks or inherited GIT_* variables", async () => {
    writeFileSync(
      fakeGit,
      '#!/bin/sh\necho "$LC_ALL $GIT_TERMINAL_PROMPT $GIT_OPTIONAL_LOCKS ${GIT_DIR-unset}"\n',
    );
    const git = gitAt({
      executable: fakeGit,
      env: { PATH: process.env.PATH, GIT_DIR: dir },
    });
    expect(await git.output([])).toEqual({ ok: true, value: "C 0 0 unset\n" });
  });

  test("output fails with git's output unless it exits 0", async () => {
    writeFileSync(fakeGit, "#!/bin/sh\necho broken >&2\nexit 1\n");
    const git = gitAt({ executable: fakeGit, env: {} });
    const result = await git.output(["status"]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain(
      "git status exited with code 1",
    );
    expect(!result.ok && result.error.message).toContain("broken");
  });
});
