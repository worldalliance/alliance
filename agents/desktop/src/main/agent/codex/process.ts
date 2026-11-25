import { mkdirSync } from "node:fs";
import { R, type Result } from "../../../../../../common/src/result";
import { agentEnvironment, type AgentFolders } from "../agent-environment";
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
  folders: AgentFolders;
};

/** Every Codex command the app runs but its version check, and every one its agents run through the codex launcher, takes these ahead of its own arguments, so no run sends analytics or feedback or checks for updates, which the app's releases manage, and its commands run in a non-login shell, where neither a profile nor macOS's path_helper moves the launchers off the front of PATH. */
export const codexConfigArgs = [
  "-c",
  "analytics.enabled=false",
  "-c",
  "feedback.enabled=false",
  "-c",
  "check_for_update_on_startup=false",
  "-c",
  "allow_login_shell=false",
] as const;

const codexCommand = (cli: CodexCli): CliCommand => ({
  executable: cli.executable,
  env: agentEnvironment(cli.folders),
  name: "codex",
});

// Codex refuses every command but --version when CODEX_HOME is missing, as on a fresh install.
export const createCodexHome = (folders: AgentFolders): Result<void, Error> =>
  R.fromThrowable(
    () => {
      mkdirSync(folders.codexHome, { recursive: true, mode: 0o700 });
    },
    (error) =>
      new Error(
        `Alliance agent couldn't create Codex's folder ${folders.codexHome}: ${R.toError(error).message}`,
      ),
  );

export async function runCodex(
  cli: CodexCli,
  run: { args: readonly string[]; signal?: AbortSignal },
): Promise<Result<Exited, Error>> {
  const home = createCodexHome(cli.folders);
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
