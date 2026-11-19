export enum AgentKind {
  Claude = "claude",
  Codex = "codex",
}

type AgentWords = {
  /** The CLI the app runs, as its install and error messages name it. */
  product: string;
};

export const agentWords: Record<AgentKind, AgentWords> = {
  [AgentKind.Claude]: { product: "Claude Code" },
  [AgentKind.Codex]: { product: "Codex" },
};
