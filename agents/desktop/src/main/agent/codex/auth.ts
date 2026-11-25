import { R, type Result } from "../../../../../../common/src/result";
import { failureOutput, queryTimeoutMs } from "../cli-process";
import { type CodexCli, runCodex } from "./process";

export enum CodexLogin {
  ChatGpt = "chatgpt",
  ApiKey = "api_key",
  OtherCredential = "other_credential",
  SignedOut = "signed_out",
}

export async function readCodexLogin(
  cli: CodexCli,
  signal = AbortSignal.timeout(queryTimeoutMs),
): Promise<Result<CodexLogin, Error>> {
  const exited = await runCodex(cli, { args: ["login", "status"], signal });
  if (!exited.ok) return exited;
  const { code, stdout, stderr } = exited.value;
  const output = `${stdout}\n${stderr}`;
  if (/^Logged in using ChatGPT$/m.test(output))
    return R.success(CodexLogin.ChatGpt);
  if (code === 1 && /^Not logged in$/m.test(output))
    return R.success(CodexLogin.SignedOut);
  if (code === 0 && /^API key configured/m.test(output))
    return R.success(CodexLogin.ApiKey);
  if (code === 0 && /^Logged in using /m.test(output))
    return R.success(CodexLogin.OtherCredential);
  return R.failure(
    new Error(
      `couldn't read codex login status: ${failureOutput("codex login status", exited.value).message}`,
    ),
  );
}

/** Signed in only through ChatGPT, since each employee uses their own subscription; any other credential, such as an API key, counts as signed out, since `codex login` replaces it. */
const signedInToApp: Record<CodexLogin, boolean> = {
  [CodexLogin.ChatGpt]: true,
  [CodexLogin.ApiKey]: false,
  [CodexLogin.OtherCredential]: false,
  [CodexLogin.SignedOut]: false,
};

export async function isSignedInToCodex(
  cli: CodexCli,
  signal?: AbortSignal,
): Promise<Result<boolean, Error>> {
  const login = await readCodexLogin(cli, signal);
  return login.ok ? R.success(signedInToApp[login.value]) : login;
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
