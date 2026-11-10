import { afterEach, describe, expect, test } from "bun:test";
import { R } from "../../../../../../common/src/result";
import { isSignedInToClaude, signInToClaude } from "./auth";
import { CaptureRecordKind } from "./testing/capture";
import {
  hangingCli,
  replay,
  stopReplay,
  stubCli,
  writeCapture,
} from "./testing/stub";

afterEach(stopReplay);

describe("sign-in", () => {
  const authCapture = (args: string[], out: string, code: number) =>
    writeCapture([
      { kind: CaptureRecordKind.Start, args },
      { kind: CaptureRecordKind.Out, text: out },
      { kind: CaptureRecordKind.Exit, code },
    ]);

  test("reads a signed-out status from its JSON despite the nonzero exit", async () => {
    replay(
      authCapture(
        ["auth", "status", "--json"],
        '{"loggedIn": false, "authMethod": "none"}',
        1,
      ),
    );
    expect(await isSignedInToClaude(stubCli)).toEqual(R.success(false));
  });

  test("reads a signed-in status", async () => {
    replay(
      authCapture(
        ["auth", "status", "--json"],
        '{"loggedIn": true, "authMethod": "claude.ai"}',
        0,
      ),
    );
    expect(await isSignedInToClaude(stubCli)).toEqual(R.success(true));
  });

  test("reports a status it can't read with the CLI's output", async () => {
    replay(authCapture(["auth", "status", "--json"], "Not JSON", 0));
    expect(await isSignedInToClaude(stubCli)).toEqual(
      R.failure(
        new Error(
          "couldn't read claude auth status: claude auth status exited with code 0: Not JSON",
        ),
      ),
    );
  });

  test("gives up on a status run that hangs", async () => {
    expect(
      await isSignedInToClaude(hangingCli(), AbortSignal.timeout(100)),
    ).toEqual(R.failure(new Error("claude auth status --json timed out")));
  });

  test("signs in when the CLI's login succeeds", async () => {
    replay(authCapture(["auth", "login", "--claudeai"], "Signed in", 0));
    expect(await signInToClaude(stubCli)).toEqual(R.success(undefined));
  });

  test("reports a failed login with the CLI's output", async () => {
    replay(authCapture(["auth", "login", "--claudeai"], "Login cancelled", 1));
    expect(await signInToClaude(stubCli)).toEqual(
      R.failure(
        new Error("claude auth login exited with code 1: Login cancelled"),
      ),
    );
  });

  test("stops the CLI's login when its signal aborts", async () => {
    replay(authCapture(["auth", "login", "--claudeai"], "Signed in", 0));
    const abort = new AbortController();
    const signingIn = signInToClaude(stubCli, abort.signal);
    abort.abort();
    expect(await signingIn).toEqual(
      R.failure(new Error("claude auth login --claudeai was cancelled")),
    );
  });
});
