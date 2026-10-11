## Decisions

- The rule keeps two renderings side by side in `server/src/actions/action-activity-status.ts`: `findLatestCompletions` for activities already in memory, and `sqlIsLatestCompletion(alias)` for SQL that aggregates or filters in the database. Aggregating reads (counts, `EXISTS`, `MAX`) cannot load every activity into memory cheaply, and in-memory reads (member status, update recognition) cannot run SQL, so neither rendering can replace the other.
- `sqlIsLatestCompletion` is a predicate on a completion row: no later terminal activity by the same member on the same action, ties broken by `id` as the welcome queue and the `RecountUsersCompleted` migration already did. It passes at most one row per (member, action) pair, so existing `COUNT(*)` queries keep counting pairs.
- The welcome queue drops its own `DISTINCT ON` rendering for `sqlIsLatestCompletion`. Its staff-comment exclusion still matches any onboarding completion row: a staff comment welcomes the member regardless of later withdrawals.
- The `RecountUsersCompleted` migration keeps its inline SQL: a migration is a snapshot of the schema and rule at the time it ran.
- Follow-up form submission loads the form by id, then requires `loadCompletions({ actionId, userId })` to be non-empty, keeping the 404 for a member who has not completed. `loadCompletions` accepts a member alongside an action for this.
