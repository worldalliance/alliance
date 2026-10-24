---
user: Charles Lien
task: Remove the `alliance/max-lines` eslint-disable "legacy" waiver from `apps/admin/src/pages/StatsPage.tsx` and make the fix it asks for
---

## User-origin requirements

- Find an eslint-disable "legacy" comment, focusing on the `alliance/max-lines` (500-line) ones, remove it, and make the appropriate fix. The goal is to fully implement that fix, not only to remove the comment.
- Commit the change as one or more minimal standalone commits.

## Chosen by an agent (not user-approved)

- The comment is the waiver on line 1 of `apps/admin/src/pages/StatsPage.tsx`: `/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */`. A coordinating agent assigned this file so that parallel agents work on different waived files.
