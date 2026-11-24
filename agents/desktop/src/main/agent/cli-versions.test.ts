import { test } from "bun:test";
import { existsSync } from "node:fs";
import { captureDir as claudeCaptureDir } from "./claude/testing/capture";
import { claudePackage, codexPackage, pinnedVersions } from "./cli-versions";
import { captureDir as codexCaptureDir } from "./codex/testing/capture";

// A version bump changes package.json and bun.lock but can't record captures, which need a signed-in CLI and real model calls.
test.each([
  {
    name: "Claude Code",
    version: pinnedVersions[claudePackage],
    dir: claudeCaptureDir(pinnedVersions[claudePackage]),
    record: "bun src/main/agent/claude/testing/capture-claude.ts",
  },
  {
    name: "Codex",
    version: pinnedVersions[codexPackage],
    dir: codexCaptureDir(pinnedVersions[codexPackage]),
    record:
      "bun scripts/codex-protocol.ts generate, then bun src/main/agent/codex/testing/capture-codex.ts",
  },
])("the bundled $name has captures", ({ name, version, dir, record }) => {
  if (!existsSync(dir))
    throw new Error(
      `${dir} is missing, so the tests can't replay ${name} ${version}. After bun install in agents/desktop, record its captures from agents/desktop with ${record}, signed in, and commit them.`,
    );
});
