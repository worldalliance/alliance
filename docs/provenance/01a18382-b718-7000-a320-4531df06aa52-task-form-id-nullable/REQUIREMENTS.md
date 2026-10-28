---
user: Charles Lien
task: Remove the `local-rules/column-optionality` "legacy" waiver from `Action.taskFormId` and make the fix it asks for
---

- Find an eslint-disable "legacy" comment, focusing on the `alliance/max-lines` (500-line) ones, remove it, and make the appropriate fix. The goal is to fully implement that fix, not only to remove the comment. (user)
- The target is the waiver on `taskFormId` in `server/src/actions/entities/action.entity.ts`: `// eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating`. No `alliance/max-lines` waivers remain. (assigned by a coordinating agent; the other `Action` waivers belong to other agents and stay as they are)
- Deliver the change as one or more minimal standalone commits. (user)
