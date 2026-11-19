import path from "node:path";

const devAppData = (appData: string) =>
  path.join(appData, "Alliance agent (dev)");

/** The one Claude config folder that development runs from any checkout sign in to, apart from a packaged app's. */
export const devClaudeConfigDir = (appData: string): string =>
  path.join(devAppData(appData), "claude");

/** The one CODEX_HOME that development runs and the Codex capture run sign in to from any checkout, apart from a packaged app's. */
export const devCodexHome = (appData: string): string =>
  path.join(devAppData(appData), "codex");
