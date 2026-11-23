import { expect, test } from "bun:test";
import { agentEnvironment } from "./agent-environment";
import { testFolders } from "./testing/folders";

test("every CLI's environment drops both vendors' namespaces but Codex's root certificate, sets both private folders and turns off Claude's nonessential traffic", () => {
  expect(
    agentEnvironment(testFolders(), {
      PATH: "/usr/bin:/bin",
      HOME: "/home/user",
      SSH_AUTH_SOCK: "/agent.sock",
      GH_TOKEN: "g",
      ANTHROPIC_API_KEY: "[redacted]",
      ANTHROPIC_AUTH_TOKEN: "[redacted]",
      ANTHROPIC_BASE_URL: "http://gateway",
      ANTHROPIC_PROFILE: "work",
      CLAUDE_CODE_OAUTH_TOKEN: "[redacted]",
      CLAUDE_CODE_USE_BEDROCK: "1",
      CLAUDE_CODE_API_BASE_URL: "http://gateway",
      CLAUDECODE: "1",
      CLAUDE_CODE_CHILD_SESSION: "1",
      CLAUDE_CODE_MESSAGING_TOKEN: "[redacted]",
      CLAUDE_CONFIG_DIR: "/home/user/.claude",
      OPENAI_API_KEY: "[redacted]",
      OPENAI_BASE_URL: "http://gateway",
      OPENAI_FEDERATION_RULE_ID: "rule",
      OPENAI_IDENTITY_TOKEN_FILE: "/token",
      CODEX_HOME: "/home/user/.codex",
      CODEX_THREAD_ID: "parent",
      CODEX_API_KEY: "[redacted]",
      CODEX_ACCESS_TOKEN: "[redacted]",
      CODEX_CONNECTORS_TOKEN: "[redacted]",
      CODEX_CA_CERTIFICATE: "/ca.pem",
      CODEX_TUI_DISABLE_KEYBOARD_ENHANCEMENT: "1",
      CODEX_REFRESH_TOKEN_URL_OVERRIDE: "http://auth",
    }),
  ).toEqual({
    PATH: "/usr/bin:/bin",
    HOME: "/home/user",
    SSH_AUTH_SOCK: "/agent.sock",
    GH_TOKEN: "g",
    CODEX_CA_CERTIFICATE: "/ca.pem",
    CLAUDE_CONFIG_DIR: "/config",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_FEEDBACK_COMMAND: "1",
    DISABLE_UPDATES: "1",
    CODEX_HOME: "/codex",
  });
});
