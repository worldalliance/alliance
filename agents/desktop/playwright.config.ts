import { defineConfig } from "@playwright/test";
import { stubCli } from "./src/main/agent/claude/testing/stub";
import { claudeExecutableVariable } from "./src/main/claude-executable";

process.env.ALLIANCE_AGENT_HEADLESS = "1";
// So no test can reach the real Claude Code.
process.env[claudeExecutableVariable] = stubCli.executable;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  forbidOnly: !!process.env.CI,
});
