import { R, type Result } from "../../../../../../common/src/result";
import { failureOutput, queryTimeoutMs } from "../cli-process";
import { type CodexCli, runCodex } from "./process";

/** Signed in only through ChatGPT, since each employee uses their own subscription; any other credential, such as an API key, counts as signed out, since `codex login` replaces it. */
export async function isSignedInToCodex(
  cli: CodexCli,
  signal = AbortSignal.timeout(queryTimeoutMs),
): Promise<Result<boolean, Error>> {
  const exited = await runCodex(cli, { args: ["login", "status"], signal });
  if (!exited.ok) return exited;
  const { code, stdout, stderr } = exited.value;
  const output = `${stdout}\n${stderr}`;
  if (/^Logged in using ChatGPT$/m.test(output)) return R.success(true);
  if (code === 1 && /^Not logged in$/m.test(output)) return R.success(false);
  if (code === 0 && /^(API key configured|Logged in using )/m.test(output))
    return R.success(false);
  return R.failure(
    new Error(
      `couldn't read codex login status: ${failureOutput("codex login status", exited.value).message}`,
    ),
  );
}

/** Runs the CLI's own ChatGPT sign-in, which opens the browser; the app never sees the credentials. */
export async function signInToCodex(
  cli: CodexCli,
  signal?: AbortSignal,
): Promise<Result<void, Error>> {
  const exited = await runCodex(cli, { args: ["login"], signal });
  if (!exited.ok) return exited;
  return exited.value.code === 0
    ? R.success(undefined)
    : R.failure(failureOutput("codex login", exited.value));
}
