---
user: Charles Lien
task: Make agents respect the production deploy process when changes must reach every environment in a specific order, and have agents set Linear issues to In Progress before starting work so other agents don't pick them up
---

# Requirements

- Agents understand without being told that merging to `main` deploys only staging, that production deploys only when `production` is synced to `main` every so often, and that a change required to be live before another must be live in every environment, production included, before the dependent change goes ahead. (user-originated)
- Before starting work on a Linear issue, an agent sets it to In Progress, as a lock so other agents don't pick it up. (user-originated)
- The claim comment records the agent's tool-prefixed session id (`claude:<uuid>` or `codex:<id>`) beside the branch, so sessions acting as the shared Linear user can be told apart, the transcript of a session that stopped without a PR can be found, and a session continuing the work through a handoff or as a subagent carries on under the existing claim instead of asking the user. (agent-proposed, user-approved)
- The instructions give agents the facts they can't work out themselves and leave edge cases to their judgement, rather than spelling out procedures, per `agents/skills/writing-for-agents/SKILL.md`. (user-originated)
