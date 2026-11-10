import type { ChildProcess } from "node:child_process";

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

const pipesCloseAfterExitMs = 1_000;

/** A descendant can hold the CLI's pipes open after it exits, which keeps "close" from firing; this ends them shortly after the exit. */
export function closePipesAfterExit(child: ChildProcess): void {
  child.once("exit", () =>
    setTimeout(() => {
      child.stdout?.destroy();
      child.stderr?.destroy();
    }, pipesCloseAfterExitMs).unref(),
  );
}
