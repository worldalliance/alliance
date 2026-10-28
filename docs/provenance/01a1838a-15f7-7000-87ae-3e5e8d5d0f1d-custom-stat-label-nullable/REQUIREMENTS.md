---
user: Charles Lien
task: Remove the `local-rules/column-optionality` "legacy" waiver from `Action.customStatLabel` and make the fix it asks for
---

- Find an eslint-disable "legacy" comment, focusing on the `alliance/max-lines` (500-line) ones, remove it, and make the appropriate fix. The goal is to fully implement that fix, not only to remove the comment. (user)
- The target is the waiver on `customStatLabel` in `server/src/actions/entities/action.entity.ts`: `// eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating`. No `alliance/max-lines` waivers remain. (assigned by a coordinating agent, which split the remaining `Action` waivers across parallel agents)
- Deliver the change as one or more minimal standalone commits. (user)
