import { existsSync } from "node:fs";
import path from "node:path";
import { R, type Result } from "../../../../../common/src/result";
import {
  type Exited,
  failureOutput,
  queryTimeoutMs,
  runCli,
} from "../agent/cli-process";
import { gitEnvironment } from "../git-environment";
import { findOnPath } from "../path-search";

export type Git = {
  run(params: {
    args: readonly string[];
    signal?: AbortSignal;
    onStderr?: (chunk: string) => void;
  }): Promise<Result<Exited, Error>>;
  /** Runs a quick command, cancelled after queryTimeoutMs. */
  query(args: readonly string[]): Promise<Result<Exited, Error>>;
  /** Runs a quick command, failing with git's output unless it exits 0. */
  output(args: readonly string[]): Promise<Result<string, Error>>;
};

const missingMessage: Record<"darwin" | "other", string> = {
  darwin:
    "Alliance agent needs Git, which comes with Apple's command line developer tools. Install them by running xcode-select --install in Terminal, then check again.",
  other: "Alliance agent needs Git. Install it, then check again.",
};

/** Finds git on env's PATH without running Apple's stub, which on a Mac without the command line developer tools opens an installer the user didn't ask for. */
export async function findGit(params: {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  appleStub?: string;
  xcodeSelect?: string;
}): Promise<Result<Git, string>> {
  const { appleStub = "/usr/bin/git", xcodeSelect = "/usr/bin/xcode-select" } =
    params;
  const missing = R.failure(
    missingMessage[params.platform === "darwin" ? "darwin" : "other"],
  );
  const executable = findOnPath("git", params.env);
  if (!executable) return missing;
  if (params.platform === "darwin" && executable === appleStub) {
    const tools = await runCli(
      {
        executable: xcodeSelect,
        env: params.env,
        name: "xcode-select",
      },
      { args: ["-p"], signal: AbortSignal.timeout(queryTimeoutMs) },
    );
    // xcode-select prints its selected folder even after the tools there are deleted.
    if (
      !tools.ok ||
      tools.value.code !== 0 ||
      !existsSync(path.join(tools.value.stdout.trim(), "usr", "bin", "git"))
    )
      return missing;
  }
  return R.success(gitAt({ executable, env: params.env }));
}

export function gitAt(params: {
  executable: string;
  env: NodeJS.ProcessEnv;
}): Git {
  const cli = {
    executable: params.executable,
    // English output, so clone progress parses; no prompt, so a clone needing credentials fails rather than hangs; no optional locks, so a status check never blocks the user's own git.
    env: {
      ...gitEnvironment(params.env),
      LC_ALL: "C",
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
    },
    name: "git",
  };
  const run: Git["run"] = (input) => runCli(cli, input);
  const query: Git["query"] = (args) =>
    run({ args, signal: AbortSignal.timeout(queryTimeoutMs) });
  return {
    run,
    query,
    output: async (args) => {
      const exited = await query(args);
      if (!exited.ok) return exited;
      return exited.value.code === 0
        ? R.success(exited.value.stdout)
        : R.failure(failureOutput(`git ${args.join(" ")}`, exited.value));
    },
  };
}
