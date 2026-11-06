---
user: Charles Lien
task: Update the provenance skill so a task's provenance files hold the requirements and decisions as they stood when that task was implemented, not the repository's current rules.
---

# Requirements

- `agents/skills/provenance/SKILL.md` says a task's provenance files hold its requirements and decisions as they stood when that task was implemented, not the repository's current rules. Its opening sentence, which called them "the current requirements", is the main place to change. (user-originated)
- A later task never edits an earlier task's provenance. Where it changes an earlier requirement, it supersedes it in its own provenance, and the earlier files stay as written. (user-originated)
- One exception: a later task may replace secrets or incidental personal information in an earlier task's provenance files with `[redacted]`. The skill states the reason, so agents can judge cases the rule doesn't name: this repository is open source, so redaction covers what shouldn't be public, and information anyone viewing the repository can already see needs none, though secrets or incidental personal information already committed to the repository still do, which is what this exception is for. The root `AGENTS.md` "Secrets and personal information" section states the same principle. (user-originated)
- A task still revises its own files in place while it is in progress, which lasts until it merges into `main`. Each merged PR ends its task, including one PR of a multi-PR plan: a later PR of the same plan gets its own new provenance directory, which references the earlier one. (user-originated)
- Other wording in the skill, and anywhere else in the repository that describes provenance files as current rules, is revised where this change makes it false. (user-originated)
- Every existing task's provenance stays untouched, including `docs/provenance/01a0b185-0403-7000-841f-9499984a8236-responses-table-view/REQUIREMENTS.md`, whose icons-over-text entry a newer skill replaces. (user-originated)
- The edit avoids the skill's Layout paragraph and the new `EVIDENCE.md` section, which the open `ux-skills` branch changes. (user-originated)
