---
user: Charles Lien
task: Retire member tags (the entity holding sets of members). Find which expand-migrate-contract step their retirement is in, label the old shape with BACKCOMPAT if needed, open a PR, and file Linear issues for the remaining steps.
---

# Requirements

- Member tags (`Tag`, sets of members) are being retired. (user-originated)
- Work out which step of root `AGENTS.md` **Breaking changes** the retirement is in, and mark the old shape `BACKCOMPAT(<tag>)` in code if it needs marking. (user-originated)
- File one or more Linear issues for the remaining steps. (user-originated)
