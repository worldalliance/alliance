import { expect, test } from "bun:test";
import { claudeEnvironment } from "./process";

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
