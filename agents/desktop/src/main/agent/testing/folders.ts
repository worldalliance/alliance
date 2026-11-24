import type { AgentFolders } from "../agent-environment";

export const testFolders = (
  folders: Partial<AgentFolders> = {},
): AgentFolders => ({
  claudeConfigDir: "/config",
  codexHome: "/codex",
  bin: "/agent-bin",
  ...folders,
});
