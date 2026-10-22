---
user: Charles Lien
task: Remove a legacy eslint-disable comment and fully implement the fix it was deferring
---

## User-origin requirements

- Find an eslint-disable comment marked "legacy", remove it, and make the appropriate fix. The purpose is to fully implement the fix, not only to remove the comment.
- Commit the change as one or more minimal standalone commits.

## Assigned by the orchestrating agent (not user-originated, not user-approved)

- The comment is the `alliance/max-lines` waiver on line 1 of `apps/frontend/src/pages/app/CommunityPage.tsx`: "TODO: legacy file over the 500-line limit; split it up".
