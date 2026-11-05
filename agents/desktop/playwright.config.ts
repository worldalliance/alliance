import { defineConfig } from "@playwright/test";

process.env.ALLIANCE_AGENT_HEADLESS = "1";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  forbidOnly: !!process.env.CI,
});
