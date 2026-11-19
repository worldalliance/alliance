import { type Result } from "../../../../../../common/src/result";
import {
  checkCliVersion,
  type CliCommand,
  type Exited,
  queryTimeoutMs,
  runCli,
} from "../cli-process";
import { CLAUDE_CODE_VERSION } from "./protocol";

export type ClaudeCli = {
  executable: string;
  /** The app-private CLAUDE_CONFIG_DIR, holding the CLI's settings, sign-in and session history. */
  configDir: string;
};

// The CLI reads its settings, credentials, endpoint and nested-session markers from these two namespaces, so none of them pass through.
// The desktop-app task's Credentials decision removes OPENAI_API_KEY from every agent process.
const inherited = (name: string) =>
  !name.startsWith("CLAUDE") &&
  !name.startsWith("ANTHROPIC_") &&
  name !== "OPENAI_API_KEY";

export function claudeEnvironment(
  configDir: string,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(base).filter(([name]) => inherited(name)),
    ),
    CLAUDE_CONFIG_DIR: configDir,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_FEEDBACK_COMMAND: "1",
    DISABLE_UPDATES: "1",
  };
}

const claudeCommand = (cli: ClaudeCli): CliCommand => ({
  executable: cli.executable,
  env: claudeEnvironment(cli.configDir),
  name: "claude",
});

export const runClaude = (
  cli: ClaudeCli,
  run: { args: readonly string[]; signal?: AbortSignal },
): Promise<Result<Exited, Error>> => runCli(claudeCommand(cli), run);

export const checkClaudeVersion = (
  cli: ClaudeCli,
  signal = AbortSignal.timeout(queryTimeoutMs),
): Promise<Result<void, Error>> =>
  checkCliVersion({
    cli: claudeCommand(cli),
    product: "Claude Code",
    pattern: /^(\S+) \(Claude Code\)$/m,
    expected: CLAUDE_CODE_VERSION,
    signal,
  });
