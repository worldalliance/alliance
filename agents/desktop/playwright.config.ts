import { defineConfig } from "@playwright/test";
import path from "node:path";
import { stubCli as claudeStub } from "./src/main/agent/claude/testing/stub";
import { stubCli as codexStub } from "./src/main/agent/codex/testing/stub";
import { executableVariable } from "./src/main/cli-executable";
import { testSourceVariable } from "./src/main/repository/source";
import { AgentKind } from "./src/shared/agent-kind";

process.env.ALLIANCE_AGENT_HEADLESS = "1";
// So no test can reach the real CLIs.
process.env[executableVariable(AgentKind.Claude)] = claudeStub.executable;
process.env[executableVariable(AgentKind.Codex)] = codexStub.executable;
// So no test clones from GitHub or finds this checkout: the default folder, e2e/, has files and no copy, so the repository waits unset.
process.env[testSourceVariable] = JSON.stringify({
  url: path.join(import.meta.dirname, "e2e", "no-repository"),
  firstCommit: "0".repeat(40),
  minimumCommit: "0".repeat(40),
  defaultFolder: path.join(import.meta.dirname, "e2e"),
});

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  forbidOnly: !!process.env.CI,
});
