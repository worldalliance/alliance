import { expect, test } from "bun:test";
import packageJson from "../../package.json" with { type: "json" };
import { AgentKind } from "../shared/agent-kind";
import { claudePackage, codexPackage } from "./agent/cli-versions";
import { packagedCliFolder } from "./cli-executable";

test("the electron-builder config copies each CLI's files to where a packaged app looks for them", () => {
  const destination = (from: string) =>
    packageJson.build.extraResources.find((entry) =>
      entry.from.startsWith(from),
    )?.to;
  expect(destination(`node_modules/${claudePackage}-`)).toBe(
    packagedCliFolder[AgentKind.Claude],
  );
  expect(destination(`node_modules/${codexPackage}-`)).toBe(
    packagedCliFolder[AgentKind.Codex],
  );
});
