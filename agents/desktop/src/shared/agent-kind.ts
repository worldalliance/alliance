export enum AgentKind {
  Claude = "claude",
  Codex = "codex",
}

type AgentWords = {
  /** The agent as the chat names it. */
  name: string;
  /** The CLI the app runs, as its install and error messages name it. */
  product: string;
  /** The subscription its sign-in uses. */
  subscription: string;
};

export const agentWords: Record<AgentKind, AgentWords> = {
  [AgentKind.Claude]: {
    name: "Claude",
    product: "Claude Code",
    subscription: "Claude",
  },
  [AgentKind.Codex]: {
    name: "Codex",
    product: "Codex",
    subscription: "ChatGPT",
  },
};
