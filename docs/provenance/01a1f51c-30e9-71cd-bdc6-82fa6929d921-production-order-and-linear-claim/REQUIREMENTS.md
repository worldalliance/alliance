---
user: Charles Lien
task: Make agents respect the production deploy process when changes must reach every environment in a specific order
---

# Requirements

- Agents understand without being told that merging to `main` deploys only staging, that production deploys only when `production` is synced to `main` every so often, and that a change required to be live before another must be live in every environment, production included, before the dependent change goes ahead. (user-originated)
- The instructions give agents the facts they can't work out themselves and leave edge cases to their judgement, rather than spelling out procedures, per `agents/skills/writing-for-agents/SKILL.md`. (user-originated)
