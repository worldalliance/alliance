import { mkdir } from "node:fs/promises";
import { R, type Result } from "../../../../../../common/src/result";
import {
  checkCliVersion,
  type CliCommand,
  type Exited,
  queryTimeoutMs,
  runCli,
} from "../cli-process";
import { CODEX_VERSION } from "./version";

export type CodexCli = {
  executable: string;
  /** The app-private CODEX_HOME, holding the CLI's config, sign-in and session history. */
  home: string;
};

// The CLI reads its credentials, endpoints, home and a parent session's markers from these two namespaces, so none of them pass through but its custom root certificate, which a TLS-intercepting proxy needs.
// The desktop-app task's Credentials decision removes the Claude credentials, Anthropic's whole namespace and Claude Code's OAuth token, from every agent process.
const inherited = (name: string) =>
  (name === "CODEX_CA_CERTIFICATE" ||
    (!name.startsWith("CODEX") && !name.startsWith("OPENAI_"))) &&
  !name.startsWith("ANTHROPIC_") &&
  name !== "CLAUDE_CODE_OAUTH_TOKEN";

export function codexEnvironment(
  home: string,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(base).filter(([name]) => inherited(name)),
    ),
    CODEX_HOME: home,
  };
}

/** Every Codex command but the version check takes these, ahead of its own arguments, so no run sends analytics or feedback or checks for updates, which the app's releases manage. */
export const codexConfigArgs = [
  "-c",
  "analytics.enabled=false",
  "-c",
  "feedback.enabled=false",
  "-c",
  "check_for_update_on_startup=false",
] as const;

const codexCommand = (cli: CodexCli): CliCommand => ({
  executable: cli.executable,
  env: codexEnvironment(cli.home),
  name: "codex",
});

// Codex refuses every command but --version when CODEX_HOME is missing, as on a fresh install.
export const createCodexHome = (cli: CodexCli): Promise<Result<void, Error>> =>
  R.fromPromise(
    mkdir(cli.home, { recursive: true, mode: 0o700 }).then(() => undefined),
    (error) =>
      new Error(
        `Alliance agent couldn't create Codex's folder ${cli.home}: ${R.toError(error).message}`,
      ),
  );

export async function runCodex(
  cli: CodexCli,
  run: { args: readonly string[]; signal?: AbortSignal },
): Promise<Result<Exited, Error>> {
  const home = await createCodexHome(cli);
  if (!home.ok) return home;
  return runCli(codexCommand(cli), {
    ...run,
    args: [...codexConfigArgs, ...run.args],
  });
}

export const checkCodexVersion = (
  cli: CodexCli,
  signal = AbortSignal.timeout(queryTimeoutMs),
): Promise<Result<void, Error>> =>
  checkCliVersion({
    cli: codexCommand(cli),
    product: "Codex",
    pattern: /^codex-cli (\S+)$/m,
    expected: CODEX_VERSION,
    signal,
  });
