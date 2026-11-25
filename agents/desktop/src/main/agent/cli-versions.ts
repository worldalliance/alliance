import { z } from "zod";
import packageJson from "../../../package.json" with { type: "json" };

export const claudePackage = "@anthropic-ai/claude-code";
export const codexPackage = "@openai/codex";

// The app supports only the exact versions it bundles, since both CLIs' structured output changes between releases.
const pinned = z.object({
  [claudePackage]: z.string().regex(/^\d+\.\d+\.\d+$/),
  [codexPackage]: z.string().regex(/^\d+\.\d+\.\d+$/),
});

export const pinnedVersions = pinned.parse(packageJson.devDependencies);
