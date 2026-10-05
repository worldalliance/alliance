---
user: Charles Lien
task: Decide which one-time invites count as accepted in one place
---

- Find duplicated code and dedup it with judgment. Choose by likely future changes, not lines deleted: one source of truth so copies can't diverge.
- One deduped item, in a standalone commit.
- "fix 1" chose the agent's proposal #1. The proposal (agent-written): six server sites decide which one-time invites count as accepted with different rules. These are user-service member stats, invite edges and ambassador stats, analytics daily stats and invite funnel, and the action `users_invited` stat. The proposal was one rule next to `invite-claim.ts`: not deleted, and an account signed up with the invite. The agent noted this changes the numbers analytics and the ambassador stats report, and asked the user to confirm the rule or pick another item; the user replied "fix 1".
