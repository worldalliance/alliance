---
user: Charles Lien
task: Give every committed change provenance
---

## User-origin requirements

- Every change that will be committed gets a provenance directory: code, tests, config, scripts, docs, and skills. A change touching only provenance directories is the exception.

## Agent-proposed, user-approved

- Skill instructions alone carry the provenance requirement; no automated check enforces it.
- For a fix, refactor, or chore that does only what the user asked, `REQUIREMENTS.md` restates the request as a requirement or two, and `DECISIONS.md` exists only when the task made a choice.
