import path from "node:path";
import { R, type Result } from "../../../../common/src/result";
import { AgentKind, agentWords } from "../shared/agent-kind";
import { claudePackage, codexPackage } from "./agent/cli-versions";
import { isExecutableFile } from "./path-search";

const variable = {
  [AgentKind.Claude]: "ALLIANCE_AGENT_CLAUDE_EXECUTABLE",
  [AgentKind.Codex]: "ALLIANCE_AGENT_CODEX_EXECUTABLE",
} as const satisfies Record<AgentKind, string>;

/** The variable naming the executable a development build runs in place of the one it bundles. */
export const executableVariable = <A extends AgentKind>(
  agent: A,
): (typeof variable)[A] => variable[agent];

// The platforms the app runs the CLIs on, whose executables have no .exe, with the target triple naming Codex's vendor folder.
const codexTriple: Record<string, string> = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
  "linux-arm64": "aarch64-unknown-linux-musl",
  "linux-x64": "x86_64-unknown-linux-musl",
};

/** Where each CLI's files sit inside a packaged app's resources. */
export const packagedCliFolder = {
  [AgentKind.Claude]: "cli/claude-code",
  [AgentKind.Codex]: "cli/codex",
} as const satisfies Record<AgentKind, string>;

const bundledPath = (params: {
  agent: AgentKind;
  platform: string;
  triple: string;
  root: string;
  packaged: boolean;
}): string => {
  const { root, platform, triple, packaged } = params;
  switch (params.agent) {
    case AgentKind.Claude:
      return path.join(
        root,
        packaged
          ? packagedCliFolder[AgentKind.Claude]
          : path.join("node_modules", `${claudePackage}-${platform}`),
        "claude",
      );
    case AgentKind.Codex:
      return path.join(
        root,
        packaged
          ? packagedCliFolder[AgentKind.Codex]
          : path.join("node_modules", `${codexPackage}-${platform}`, "vendor"),
        triple,
        "bin",
        "codex",
      );
    default:
      throw new Error(`unknown agent: ${params.agent satisfies never}`);
  }
};

/** The CLI the app runs: the copy it bundles, from the package's node_modules in a development build or its resources when packaged, or in a development build the executable the agent's variable names. */
export function findExecutable(params: {
  agent: AgentKind;
  env: NodeJS.ProcessEnv;
  packaged: boolean;
  /** The app's folder in a development build, its resources folder when packaged. */
  root: string;
  platform: NodeJS.Platform;
  arch: string;
}): Result<string, Error> {
  const { product } = agentWords[params.agent];
  const name = variable[params.agent];
  const named = params.packaged ? undefined : params.env[name];
  if (named) {
    // Sessions spawn the CLI in the user's folder, so a relative path would resolve differently there.
    const executable = path.resolve(named);
    return isExecutableFile(executable)
      ? R.success(executable)
      : R.failure(
          new Error(
            `couldn't find ${product} at ${executable}, which ${name} names.`,
          ),
        );
  }
  const platform = `${params.platform}-${params.arch}`;
  const triple = codexTriple[platform];
  if (!triple)
    return R.failure(
      new Error(`Alliance agent doesn't include ${product} for ${platform}.`),
    );
  const executable = bundledPath({ ...params, platform, triple });
  if (isExecutableFile(executable)) return R.success(executable);
  return R.failure(
    new Error(
      params.packaged
        ? `this build of Alliance agent doesn't include ${product} for ${platform}: ${executable} is missing or not executable.`
        : `couldn't find the ${product} Alliance agent bundles at ${executable}. Run bun install in ${params.root}.`,
    ),
  );
}
