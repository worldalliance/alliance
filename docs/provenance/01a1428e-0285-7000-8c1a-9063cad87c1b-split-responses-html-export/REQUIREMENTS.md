---
user: Charles Lien
task: Remove one eslint-disable "legacy" comment and fully implement the fix it was deferring
---

## User-origin requirements

- Find an eslint-disable comment marked "legacy", remove it, and make the appropriate fix. The goal is the full fix, not just removing the comment.
- Commit the change as one or more minimal standalone commits.
- Review each commit, fix the issues classified as fix-now, file follow-ups in Linear, and repeat until reviews come up clean; then open a PR.

## Assigned by the orchestrating agent (not user-originated, not user-approved)

- The target comment is the `alliance/max-lines` waiver on line 1 of `apps/admin/src/lib/responsesHtmlExport.ts`: `/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */`.
