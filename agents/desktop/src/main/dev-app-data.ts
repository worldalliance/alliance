import path from "node:path";

/** One Claude sign-in serves every checkout's unpackaged app and capture-claude.ts, apart from a packaged app's. */
export const devClaudeConfigDir = (appData: string): string =>
  path.join(appData, "Alliance agent (dev)", "claude");
