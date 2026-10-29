---
user: Charles Lien
task: Move the code-check procedures out of the root AGENTS.md into the implement skill
---

## Agent-proposed, user-approved

- The root `AGENTS.md` keeps rules that apply at every edit or review of code; procedures that run when verifying a change live in `skills/implement/SKILL.md`. This moves the Testing, Duplication, Coverage, Formatting, Workflows, and Success criteria sections there, unchanged in substance.
- The coding rules (Fail loudly, Enum branching, Type casts, Result type, and the rest) stay in `AGENTS.md`.
