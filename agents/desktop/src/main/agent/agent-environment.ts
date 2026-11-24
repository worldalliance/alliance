import path from "node:path";

/** The app-private folders both CLIs run with, so a CLI an agent starts by bare name gets the app's sign-in and settings whichever agent started it. */
export type AgentFolders = {
  /** CLAUDE_CONFIG_DIR, holding Claude Code's settings, sign-in and session history. */
  claudeConfigDir: string;
  /** CODEX_HOME, holding Codex's config, sign-in and session history. */
  codexHome: string;
  /** Holds the claude and codex launchers, first on the agents' PATH. */
  bin: string;
};

// Each CLI reads its credentials, endpoints, home and a parent session's markers from these namespaces. Codex's custom root certificate passes, since a TLS-intercepting proxy needs it.
const inherited = (name: string) =>
  name === "CODEX_CA_CERTIFICATE" ||
  (!name.startsWith("CLAUDE") &&
    !name.startsWith("ANTHROPIC_") &&
    !name.startsWith("CODEX") &&
    !name.startsWith("OPENAI_"));

/** The environment every CLI the app runs gets, and through it every command its agents run. */
export function agentEnvironment(
  folders: AgentFolders,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(base).filter(([name]) => inherited(name)),
    ),
    PATH: [folders.bin, base.PATH].filter(Boolean).join(path.delimiter),
    CLAUDE_CONFIG_DIR: folders.claudeConfigDir,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_FEEDBACK_COMMAND: "1",
    DISABLE_UPDATES: "1",
    CODEX_HOME: folders.codexHome,
  };
}
