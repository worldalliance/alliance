---
user: Charles Lien
task: Remove the `alliance/max-lines` eslint-disable "legacy" waiver from `server/src/user/dto/user.dto.ts` and make the fix it asks for
---

## User-origin requirements

- Find an eslint-disable "legacy" comment, focusing on the `alliance/max-lines` (500-line) ones, remove it, and make the appropriate fix. The goal is to fully implement that fix, not only to remove the comment.
- Commit the change as one or more minimal standalone commits.

## Chosen by the agent (not user-approved)

- The comment is the waiver on line 1 of `server/src/user/dto/user.dto.ts`: `/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */`.
