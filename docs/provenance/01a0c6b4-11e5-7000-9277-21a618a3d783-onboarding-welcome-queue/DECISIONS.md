# Queue rules

- Active required tasks have `onboarding = true`, `optional = false`, `archived = false`, `preventCompletion = false`, and current status `MemberAction`. Use the existing action status getter so future events do not activate tasks early.
- Required tasks apply per member using the existing completion timing and cohort rules. Members with no applicable tasks have no qualifying completion to link and stay out of the queue.
- Return the active required task count alongside members so the page distinguishes missing configuration from an empty queue.
- Interpret "have signed the contract" as having a `SIGNED` contract event. Later suspension does not erase that signing. Check existence so repeated signatures do not duplicate queue entries.
- A task counts as completed when the member's latest completion or withdrawal on it is a completion, the rule `findLatestTerminalActivity` applies elsewhere. Pass `TERMINAL_ACTIVITY_TYPES` to the query so a new terminal type cannot drift from that rule.
- Link to the latest completion among the qualifying tasks, using activity ID to break timestamp ties.
- Any non-deleted comment from a current staff member on an onboarding completion counts as a greeting, including archived or optional onboarding tasks. This is an advisory approximation, not a separate greeting record.
- Apply no date cutoff so older members who still need a welcome remain eligible.
- Derive queue eligibility from existing actions and comments to keep the advisory queue simple.
