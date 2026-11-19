import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";
import { R, type Result } from "../../../../common/src/result";
import { AgentKind, agentWords } from "../shared/agent-kind";
import { CLAUDE_CODE_VERSION } from "./agent/claude/protocol";
import { CODEX_VERSION } from "./agent/codex/version";

const cli = {
  [AgentKind.Claude]: {
    command: "claude",
    variable: "ALLIANCE_AGENT_CLAUDE_EXECUTABLE",
    version: CLAUDE_CODE_VERSION,
  },
  [AgentKind.Codex]: {
    command: "codex",
    variable: "ALLIANCE_AGENT_CODEX_EXECUTABLE",
    version: CODEX_VERSION,
  },
} as const satisfies Record<
  AgentKind,
  { command: string; variable: string; version: string }
>;

/** The variable naming the executable to run in place of the one on PATH. */
export const executableVariable = <A extends AgentKind>(
  agent: A,
): (typeof cli)[A]["variable"] => cli[agent].variable;

// Until ALL-2029 bundles the CLIs.
export function findExecutable(params: {
  agent: AgentKind;
  env: NodeJS.ProcessEnv;
  packaged: boolean;
}): Result<string, Error> {
  const { command, variable, version } = cli[params.agent];
  const { product } = agentWords[params.agent];
  if (params.packaged)
    return R.failure(
      new Error(`this build of Alliance agent doesn't include ${product}.`),
    );
  const named = params.env[variable];
  // Sessions spawn the CLI in the user's folder, so a relative path would resolve differently there.
  if (named) return R.success(path.resolve(named));
  const found = (params.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((dir) => path.resolve(dir, command))
    .find((file) => {
      const isFile = R.fromThrowable(() => {
        accessSync(file, constants.X_OK);
        return statSync(file).isFile();
      });
      return R.isSuccess(isFile) && isFile.value;
    });
  return R.fromNullable(
    found,
    new Error(
      `couldn't find ${product}. Install ${product} ${version} so that ${command} is on PATH.`,
    ),
  );
}
