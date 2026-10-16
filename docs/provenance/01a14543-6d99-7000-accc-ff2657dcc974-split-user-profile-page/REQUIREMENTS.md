---
user: Charles Lien
task: Remove the `alliance/max-lines` eslint-disable "legacy" waiver from `apps/frontend/src/pages/app/UserProfilePage.tsx` and make the fix it asks for
---

## User-origin requirements

- Find an eslint-disable "legacy" comment, focusing on the 500-line `alliance/max-lines` ones, remove it, and make the appropriate fix. The goal is to fully implement that fix, not only to remove the comment.
- Commit the change as minimal standalone commits: several if needed, otherwise one.

## Agent-assigned (by the orchestrating agent, not the user)

- The waiver is the one on line 1 of `apps/frontend/src/pages/app/UserProfilePage.tsx`: `/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */`.
