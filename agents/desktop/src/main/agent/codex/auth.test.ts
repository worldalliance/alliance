import { afterEach, expect, test } from "bun:test";
import { R } from "../../../../../../common/src/result";
import { CaptureRecordKind } from "../testing/capture-record";
import {
  CodexLogin,
  isSignedInToCodex,
  readCodexLogin,
  signInToCodex,
} from "./auth";
import { codexConfigArgs } from "./process";
import { replay, stopReplay, stubCli, writeCapture } from "./testing/stub";

afterEach(stopReplay);

const loginStatus = (stderr: string, code: number) =>
  replay(
    writeCapture([
      {
        kind: CaptureRecordKind.Start,
        args: [...codexConfigArgs, "login", "status"],
      },
      { kind: CaptureRecordKind.StdinClosed },
      { kind: CaptureRecordKind.Stderr, text: stderr },
      { kind: CaptureRecordKind.Exit, code },
    ]),
  );

test("codex login status decides whether Codex is signed in through ChatGPT", async () => {
  loginStatus("Logged in using ChatGPT\n", 0);
  expect(await isSignedInToCodex(stubCli)).toEqual(R.success(true));
  loginStatus("Not logged in\n", 1);
  expect(await isSignedInToCodex(stubCli)).toEqual(R.success(false));
  loginStatus("API key configured - sk-[redacted]\n", 0);
  expect(await isSignedInToCodex(stubCli)).toEqual(R.success(false));
  loginStatus("Logged in using access token\n", 0);
  expect(await isSignedInToCodex(stubCli)).toEqual(R.success(false));
});

test("codex login status tells an API key apart from other credentials", async () => {
  loginStatus("API key configured - sk-[redacted]\n", 0);
  expect(await readCodexLogin(stubCli)).toEqual(R.success(CodexLogin.ApiKey));
  loginStatus("Logged in using access token\n", 0);
  expect(await readCodexLogin(stubCli)).toEqual(
    R.success(CodexLogin.OtherCredential),
  );
});

test("a login status Alliance agent doesn't recognise, or with an unexpected exit code, fails, quoting it", async () => {
  loginStatus("Error checking login status: unreadable auth.json\n", 1);
  const status = await isSignedInToCodex(stubCli);
  expect(status.ok ? "" : status.error.message).toBe(
    "couldn't read codex login status: codex login status exited with code 1: Error checking login status: unreadable auth.json",
  );
  loginStatus("Not logged in\n", 0);
  expect((await isSignedInToCodex(stubCli)).ok).toBe(false);
  loginStatus("API key configured - sk-[redacted]\n", 1);
  expect((await isSignedInToCodex(stubCli)).ok).toBe(false);
});

test("sign-in succeeds when codex login does, and fails with its output when it doesn't", async () => {
  const login = (code: number, stderr: string) =>
    replay(
      writeCapture([
        { kind: CaptureRecordKind.Start, args: [...codexConfigArgs, "login"] },
        { kind: CaptureRecordKind.StdinClosed },
        { kind: CaptureRecordKind.Stderr, text: stderr },
        { kind: CaptureRecordKind.Exit, code },
      ]),
    );
  login(0, "Successfully logged in\n");
  expect(await signInToCodex(stubCli)).toEqual(R.success(undefined));
  login(1, "Error logging in: Login cancelled\n");
  const failed = await signInToCodex(stubCli);
  expect(failed.ok ? "" : failed.error.message).toBe(
    "codex login exited with code 1: Error logging in: Login cancelled",
  );
});
