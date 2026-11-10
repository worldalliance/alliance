import { expect, onTestFinished, test } from "bun:test";
import { spawn } from "node:child_process";
import { claudeEnvironment, closePipesAfterExit } from "./process";

test("the CLI's environment drops its inherited namespaces and other credentials and turns off nonessential traffic", () => {
  const env = claudeEnvironment("/config", {
    PATH: "/bin",
    HOME: "/home/user",
    SSH_AUTH_SOCK: "/agent.sock",
    GH_TOKEN: "g",
    ANTHROPIC_API_KEY: "a",
    ANTHROPIC_AUTH_TOKEN: "b",
    ANTHROPIC_BASE_URL: "http://gateway",
    ANTHROPIC_PROFILE: "work",
    CLAUDE_CODE_OAUTH_TOKEN: "c",
    CLAUDE_CODE_USE_BEDROCK: "1",
    CLAUDE_CODE_API_BASE_URL: "http://gateway",
    CLAUDECODE: "1",
    CLAUDE_CODE_CHILD_SESSION: "1",
    CLAUDE_CODE_MESSAGING_TOKEN: "m",
    CLAUDE_CONFIG_DIR: "/home/user/.claude",
    OPENAI_API_KEY: "d",
  });
  expect(env).toEqual({
    PATH: "/bin",
    HOME: "/home/user",
    SSH_AUTH_SOCK: "/agent.sock",
    GH_TOKEN: "g",
    CLAUDE_CONFIG_DIR: "/config",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_FEEDBACK_COMMAND: "1",
    DISABLE_UPDATES: "1",
  });
});

test("closes the pipes of an exited CLI that a process it started still holds", async () => {
  // Under load Bun can miss both the output and the exit of a child that exits at once, so the shell lingers.
  const child = spawn("sh", ["-c", "sleep 30 & echo $!; sleep 0.5"]);
  closePipesAfterExit(child);
  let stdout = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
  onTestFinished(() => {
    if (/^\d+\n$/.test(stdout)) process.kill(Number(stdout));
  });
  await new Promise((resolve) => child.once("close", resolve));
  expect(stdout).toMatch(/^\d+\n$/);
});
