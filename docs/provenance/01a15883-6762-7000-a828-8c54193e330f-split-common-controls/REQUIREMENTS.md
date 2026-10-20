---
user: Charles Lien
task: Remove a legacy eslint-disable comment and make the fix it was standing in for
---

## User-origin requirements

- Find an eslint-disable "legacy" comment, remove it, and make the appropriate fix. The purpose is to fully implement the fix, not only to remove the comment.
- Commit the change as one or more minimal standalone commits.

## Assigned by the orchestrating agent (not user-originated, not user-approved)

- The comment is the `alliance/max-lines` waiver on line 1 of `apps/admin/src/components/form-fields/CommonControls.tsx`: "TODO: legacy file over the 500-line limit; split it up".
