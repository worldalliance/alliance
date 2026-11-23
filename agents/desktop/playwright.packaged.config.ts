import { defineConfig } from "@playwright/test";

// Runs against the folder `bun run package` builds, so it needs that build first; `bun run test:packaged` does both.
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.packaged.ts",
  // A sibling of the regular suite's test-results, since each run empties its own outputDir.
  outputDir: "test-results-packaged",
  forbidOnly: !!process.env.CI,
});
