---
user: Charles Lien
task: One source of truth for whether a member has completed an action
---

## Requirements

- A member counts as having completed an action only when their latest terminal activity on it (a completion or a withdrawal) is a completion, the rule the member's own status already follows. (user-originated: dedup so behavior cannot diverge)
- The `CompletedAction` cohort leaf follows that rule on both the population path and the single-member path. (agent-proposed, user-approved)
- The stored `usersCompleted` count follows that rule, and is recounted when a member withdraws as well as when they complete. (agent-proposed, user-approved)
- A member who withdraws after completing no longer satisfies `CompletedAction` and no longer counts toward `usersCompleted`; a member who completes after withdrawing still does. (agent-proposed, user-approved)
- One deduplicated item, in a standalone commit. (user-originated)

## Out of scope

- `findParticipantIdsForActions`, `findIncompleteUsersForAction`, analytics queries, `getCompletedActionCount`, the community completed-actions count, and follow-up form gating. (agent-proposed, user-approved for participants and analytics)
