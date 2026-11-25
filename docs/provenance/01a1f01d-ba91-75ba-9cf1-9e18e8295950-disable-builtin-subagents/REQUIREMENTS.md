---
user: Charles Lien
task: Disable subagents in this repo, then create a PR
---

# Requirements

- Block the subagent tools built into the coding agents' harnesses, leaving subagents spawned through the `claude` and `codex` CLIs per `agents/skills/subagents/SKILL.md` working. (agent-proposed, user-approved)
- Claude Code: add `Agent` to `permissions.deny` in `.claude/settings.json`. (agent-proposed, user-approved)
- Codex: ship no change in this task, since no setting was found that blocks its `spawn_agent` tool; record that gap. (agent-proposed, user-approved)
