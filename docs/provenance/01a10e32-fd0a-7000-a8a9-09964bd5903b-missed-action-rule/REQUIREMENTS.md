---
user: Charles Lien
task: Decide whether a member missed a required action in one place
---

- Find duplicated code and deduplicate one item, grouping code by its likely future changes so there is a single source of truth and behavior can't diverge. Put it in a standalone commit.
- The agent reported three implementations of "did this member miss this action": the `MissedActionDeadline` cohort leaf (`computeMissedActionDeadline`), suspension (`ActionsService.buildSuspendPlanContext`), and the admin "Missed last action / Missed last two actions" stats (`AnalyticsService.getMissedActions`). The admin stats counted only completions as clearing a miss, where the other two also count withdrawals, and took the member-action window from the earliest member-action event rather than `memberActionPhase`. The user chose this item ("fix 2").
- The agent offered: (A) share the rule between the cohort leaf and suspension only; (B) also move the admin stats onto it, so withdrawals stop counting as misses there and rescheduled actions use the same window as everywhere else, while the stats keep their own framing (last two actions, active contract now, onboarding and public-only excluded); (C) only switch the admin stats to the shared set of activities that clear a miss. The agent recommended B and asked the user to confirm the change to what admins see. The user chose B.
