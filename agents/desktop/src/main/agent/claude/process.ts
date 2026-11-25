import { type Result } from "../../../../../../common/src/result";
import { agentEnvironment, type AgentFolders } from "../agent-environment";
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
  folders: AgentFolders;
};

const claudeCommand = (cli: ClaudeCli): CliCommand => ({
  executable: cli.executable,
  env: agentEnvironment(cli.folders),
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
