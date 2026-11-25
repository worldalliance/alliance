import { afterEach, describe, expect, test } from "bun:test";
import { R } from "../../../../../../common/src/result";
import { testFolders } from "../testing/folders";
import { type ClaudeCli, checkClaudeVersion, runClaude } from "./process";
import { CLAUDE_CODE_VERSION } from "./protocol";
import { CaptureRecordKind, captured } from "./testing/capture";
import {
  hangingCli,
  replay,
  stopReplay,
  stubCli,
  writeCapture,
} from "./testing/stub";

const bun: ClaudeCli = {
  executable: process.execPath,
  folders: testFolders(),
};

test("runs the CLI in that environment and returns its exit and output", async () => {
  const result = await runClaude(bun, {
    args: [
      "-e",
      "console.log(process.env.CLAUDE_CONFIG_DIR); console.error('warn'); process.exit(3)",
    ],
  });
  expect(result).toEqual(
    R.success({ code: 3, signal: null, stdout: "/config\n", stderr: "warn\n" }),
  );
});

describe("the version check", () => {
  afterEach(stopReplay);

  test("accepts the version the captures came from", async () => {
    replay(captured("version"));
    expect(await checkClaudeVersion(stubCli)).toEqual(R.success(undefined));
  });

  test("refuses another version, naming both", async () => {
    replay(
      writeCapture([
        { kind: CaptureRecordKind.Start, args: ["--version"] },
        { kind: CaptureRecordKind.Out, text: "9.9.9 (Claude Code)" },
        { kind: CaptureRecordKind.Exit, code: 0 },
      ]),
    );
    expect(await checkClaudeVersion(stubCli)).toEqual(
      R.failure(
        new Error(
          `${stubCli.executable} is Claude Code 9.9.9, but Alliance agent supports only ${CLAUDE_CODE_VERSION}. In a development build, run bun install in agents/desktop.`,
        ),
      ),
    );
  });

  test("refuses output that names no Claude Code version", async () => {
    replay(
      writeCapture([
        { kind: CaptureRecordKind.Start, args: ["--version"] },
        { kind: CaptureRecordKind.Out, text: "usage: other-tool" },
        { kind: CaptureRecordKind.Exit, code: 0 },
      ]),
    );
    expect(await checkClaudeVersion(stubCli)).toEqual(
      R.failure(
        new Error(
          `${stubCli.executable} --version printed no Claude Code version: usage: other-tool`,
        ),
      ),
    );
  });

  test("refuses empty output", async () => {
    replay(
      writeCapture([
        { kind: CaptureRecordKind.Start, args: ["--version"] },
        { kind: CaptureRecordKind.Exit, code: 0 },
      ]),
    );
    expect(await checkClaudeVersion(stubCli)).toEqual(
      R.failure(
        new Error(
          `${stubCli.executable} --version printed no Claude Code version`,
        ),
      ),
    );
  });

  test("refuses output that names no Claude Code version with its stderr", async () => {
    replay(
      writeCapture([
        { kind: CaptureRecordKind.Start, args: ["--version"] },
        { kind: CaptureRecordKind.Stderr, text: "Cannot find module" },
        { kind: CaptureRecordKind.Exit, code: 0 },
      ]),
    );
    expect(await checkClaudeVersion(stubCli)).toEqual(
      R.failure(
        new Error(
          `${stubCli.executable} --version printed no Claude Code version: Cannot find module`,
        ),
      ),
    );
  });

  test("refuses output that names no Claude Code version with its stdout over its stderr", async () => {
    replay(
      writeCapture([
        { kind: CaptureRecordKind.Start, args: ["--version"] },
        { kind: CaptureRecordKind.Stderr, text: "ExperimentalWarning" },
        { kind: CaptureRecordKind.Out, text: "Claude Code 3.0.0" },
        { kind: CaptureRecordKind.Exit, code: 0 },
      ]),
    );
    expect(await checkClaudeVersion(stubCli)).toEqual(
      R.failure(
        new Error(
          `${stubCli.executable} --version printed no Claude Code version: Claude Code 3.0.0`,
        ),
      ),
    );
  });

  test("reports a version run that fails", async () => {
    replay(
      writeCapture([
        { kind: CaptureRecordKind.Start, args: ["--version"] },
        { kind: CaptureRecordKind.Stderr, text: "boom" },
        { kind: CaptureRecordKind.Exit, code: 1 },
      ]),
    );
    expect(await checkClaudeVersion(stubCli)).toEqual(
      R.failure(
        new Error(`${stubCli.executable} --version exited with code 1: boom`),
      ),
    );
  });

  test("gives up on a version run that hangs", async () => {
    expect(
      await checkClaudeVersion(hangingCli(), AbortSignal.timeout(100)),
    ).toEqual(R.failure(new Error("claude --version timed out")));
  });
});
