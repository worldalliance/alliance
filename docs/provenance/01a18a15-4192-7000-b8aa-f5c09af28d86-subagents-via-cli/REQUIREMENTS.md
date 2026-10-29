---
user: Charles Lien
task: Tell agents to spawn subagents through the claude and codex CLIs
---

# Requirements

- Agents spawn subagents by running the `claude -p` or `codex` CLI from the shell, in place of the harness's built-in agent tool. (user)
- The documented commands use `claude --dangerously-skip-permissions -p --output-format=stream-json` and its codex equivalent, `codex exec --dangerously-bypass-approvals-and-sandbox --json`. (user; the flag spellings and codex equivalent verified by the agent)
