---
user: Charles Lien
task: Maintain agent docs like code
---

## User-origin requirements

- Skills are maintained like code: they are instructions an agent executes, with no type checker behind them.

## Agent-proposed, user-approved

- `skills/writing-for-agents/SKILL.md` states that a reference to a document's path or heading breaks silently when its target is renamed, moved, or deleted, so the edit that does so updates every reference to it throughout the repository.
