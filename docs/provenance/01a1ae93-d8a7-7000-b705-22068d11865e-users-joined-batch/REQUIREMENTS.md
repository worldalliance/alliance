---
user: Charles Lien
task: Fix the CPU cost of `Action.usersJoined` recomputation without changing its value or meaning.
---

- `ActionParticipantsService.reloadAllActionUsersJoined` computes every action's `usersJoined` in one batched pass with lean (column-only) loads of users and activities, and writes only the counts that changed, in bulk where reasonable. (agent-proposed, user-approved)
- The single-action recompute on the write paths (activity writes in `action-activity.service.ts`, event creation in `action-suites.service.ts`) uses the same lean loading. (agent-proposed, user-approved)
- Counts stay identical to the current formula: assigned base recipients, minus members away at any point in the member-action window, minus members whose latest terminal activity is a withdrawal, plus members whose latest terminal activity is a completion. Reuse the existing predicates and cohort resolution instead of duplicating the eligibility rule; a shared loader changed for lean loading keeps its other callers' behavior identical. (agent-proposed, user-approved)
- `ReloadUsersJoinedWorker` awaits the job under a Postgres advisory lock (`withPgAdvisoryLock` with a `LOCK_KEYS` entry), logs failures, and logs a warning when a run takes longer than its 10-minute interval. (agent-proposed, user-approved)
- Tests show the batched lean path gives the same counts as the per-action path on a fixture covering assignment, away ranges, withdrawal, completion, and saved versus live cohort decisions, and that worker runs don't overlap. (agent-proposed, user-approved)
- Out of scope: changing what `usersJoined` means, the task badge sweep, separate worker processes, SQL views. (agent-proposed, user-approved)
