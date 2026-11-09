---
user: Charles Lien
task: Document when a branch should carry its Linear issue's key, with the conditions set by research.
---

# Requirements

- The repository documents when a branch name carries its Linear issue's key. (user-originated)
- The rule: link work to an issue in text, with `Fixes ALL-XXXX` in the PR description and in the commit message when the issue already exists, and `Part of ALL-XXXX` until the last PR of an issue spanning several. A branch is named `all-XXXX-<slug>` when the issue exists before it, as a preference. A branch is not renamed to add a key. (agent-proposed, user-approved)
