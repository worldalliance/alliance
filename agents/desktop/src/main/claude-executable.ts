import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";
import { R, type Result } from "../../../../common/src/result";
import { CLAUDE_CODE_VERSION } from "./agent/claude/protocol";

export const claudeExecutableVariable = "ALLIANCE_AGENT_CLAUDE_EXECUTABLE";

// Until ALL-2029 bundles the CLI.
export function findClaudeExecutable(params: {
  env: NodeJS.ProcessEnv;
  packaged: boolean;
}): Result<string, Error> {
  if (params.packaged)
    return R.failure(
      new Error("this build of Alliance agent doesn't include Claude Code."),
    );
  const named = params.env[claudeExecutableVariable];
  // Sessions spawn the CLI in the user's folder, so a relative path would resolve differently there.
  if (named) return R.success(path.resolve(named));
  const found = (params.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((dir) => path.resolve(dir, "claude"))
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
      `couldn't find Claude Code. Install Claude Code ${CLAUDE_CODE_VERSION} so that claude is on PATH.`,
    ),
  );
}
