import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

process.env.ALLIANCE_AGENT_HEADLESS = "1";
// The app runs the stub in place of Claude Code, so no test reaches the real CLI; each test names the captures it replays.
process.env.ALLIANCE_AGENT_CLAUDE_EXECUTABLE = fileURLToPath(
  new URL("src/main/agent/claude/testing/stub-claude.ts", import.meta.url),
);

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  forbidOnly: !!process.env.CI,
});
