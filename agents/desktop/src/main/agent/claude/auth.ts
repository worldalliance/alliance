import { z } from "zod";
import { R, type Result } from "../../../../../../common/src/result";
import {
  type ClaudeCli,
  failureOutput,
  queryTimeoutMs,
  runClaude,
} from "./process";

const authStatus = z.looseObject({ loggedIn: z.boolean() });

export async function isSignedInToClaude(
  cli: ClaudeCli,
  signal = AbortSignal.timeout(queryTimeoutMs),
): Promise<Result<boolean, Error>> {
  const exited = await runClaude(cli, {
    args: ["auth", "status", "--json"],
    signal,
  });
  if (!exited.ok) return exited;
  // Signed out exits nonzero with the same JSON, so the JSON decides, not the exit code.
  return R.fromThrowable(
    () => authStatus.parse(JSON.parse(exited.value.stdout)).loggedIn,
    () =>
      new Error(
        `couldn't read claude auth status: ${failureOutput("claude auth status", exited.value).message}`,
      ),
  );
}

/** Runs the CLI's own claude.ai sign-in, which opens the browser; the app never sees the credentials. */
export async function signInToClaude(
  cli: ClaudeCli,
  signal?: AbortSignal,
): Promise<Result<void, Error>> {
  const exited = await runClaude(cli, {
    args: ["auth", "login", "--claudeai"],
    signal,
  });
  if (!exited.ok) return exited;
  return exited.value.code === 0
    ? R.success(undefined)
    : R.failure(failureOutput("claude auth login", exited.value));
}
