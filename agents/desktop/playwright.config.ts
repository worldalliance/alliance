import { defineConfig } from "@playwright/test";
import { stubCli as claudeStub } from "./src/main/agent/claude/testing/stub";
import { stubCli as codexStub } from "./src/main/agent/codex/testing/stub";
import { executableVariable } from "./src/main/cli-executable";
import { AgentKind } from "./src/shared/agent-kind";

process.env.ALLIANCE_AGENT_HEADLESS = "1";
// So no test can reach the real CLIs.
process.env[executableVariable(AgentKind.Claude)] = claudeStub.executable;
process.env[executableVariable(AgentKind.Codex)] = codexStub.executable;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  forbidOnly: !!process.env.CI,
});
