---
user: Charles Lien
task: Remove the `local-rules/column-optionality` "legacy" waiver from `Action.squareThumbnailImageAlt` and make the fix it asks for
---

- Find an eslint-disable comment marked "legacy", remove it, and make the appropriate fix. The goal is to fully implement that fix, not only to remove the comment. (user)
- The target is the waiver on `squareThumbnailImageAlt` in `server/src/actions/entities/action.entity.ts`: `// eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating`. (agent-proposed; the user left the choice of comment to the agent)
- Deliver the change as one or more minimal standalone commits. (user)
