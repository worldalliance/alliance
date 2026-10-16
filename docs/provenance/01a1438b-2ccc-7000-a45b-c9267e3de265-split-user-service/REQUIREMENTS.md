---
user: Charles Lien
task: Remove the `alliance/max-lines` eslint-disable "legacy" waiver from `server/src/user/user.service.ts` and make the fix it asks for
---

## User-origin requirements

- Find an eslint-disable "legacy" comment, remove it, and make the appropriate fix. The goal is to fully implement that fix, not only to remove the comment.
- Commit the change as minimal standalone commits: several if needed, otherwise one.

## Assigned by the orchestrating agent (agent-assigned; the user left the choice to the agent)

- The waiver is the `alliance/max-lines` one on line 1 of `server/src/user/user.service.ts`: "TODO: legacy file over the 500-line limit; split it up".
