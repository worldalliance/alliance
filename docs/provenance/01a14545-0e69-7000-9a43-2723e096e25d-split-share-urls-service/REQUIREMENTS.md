---
user: Charles Lien
task: Remove the `alliance/max-lines` eslint-disable "legacy" waiver from `server/src/share-urls/share-urls.service.ts` and make the fix it asks for
---

## User-origin requirements

- Find an eslint-disable "legacy" comment, focusing on the 500-line `alliance/max-lines` ones, remove it, and make the appropriate fix. The goal is to fully implement that fix, not only to remove the comment.
- Commit the change as minimal standalone commits: several if needed, otherwise one.

## Assigned by the orchestrating agent (neither user-originated nor user-approved)

- The waiver is the one on line 1 of `server/src/share-urls/share-urls.service.ts`: `/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */`. The user left the choice of waiver to the agent.
