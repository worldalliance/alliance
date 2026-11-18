# Decisions

- `Agent` is the tool name Claude Code denies, joining the existing `Artifact` and `Workflow` entries. The deny also applies to `claude -p` subagents run from the repo, which spawn through the CLI, not the tool. (agent decision)
- Codex gets no config, hook, or skill change: none of the settings tried in `EVIDENCE.md` stopped `spawn_agent`, and a config that reads as disabling it while it still works would mislead. A trusted PreToolUse hook denying `spawn_agent` is the one route left untried. (agent proposal, user-approved per `REQUIREMENTS.md`)
- The `SubagentStop` transcript-upload hook in `.claude/settings.json` stays: skills run with `context: fork` still run as subagents. (agent decision)
