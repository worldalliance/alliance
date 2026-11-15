import path from "node:path";

/** The one Claude config folder that development runs from any checkout sign in to, apart from a packaged app's. */
export const devClaudeConfigDir = (appData: string): string =>
  path.join(appData, "Alliance agent (dev)", "claude");
