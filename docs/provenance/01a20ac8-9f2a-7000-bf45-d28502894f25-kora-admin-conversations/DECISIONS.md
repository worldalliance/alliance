# Decisions

- "Reviewed" counts finished reviews only (status done, assignment not deleted), shown against the batch's target as "3 of 5". Reviews in progress are left out because their time isn't final. (agent decision)
- Rows are ordered newest batch first, then by the conversation's position in its upload. (agent decision)
- The table reads a new `GET /kora/admin/conversations`. `GET /kora/admin/categories` stays, marked `BACKCOMPAT(kora-admin-categories)`, because the admin and backend deploy separately; remove it once an admin build reading `/conversations` is live in production. (agent decision, following the root AGENTS.md expand-migrate-contract rule)
- Times come from each finished result's `timeMs` in the stored export; the median is Postgres's `percentile_cont(0.5)`, rounded to the millisecond, so an even count averages the middle two. (agent decision)
- Times are formatted with date-fns `formatDuration` in hours, minutes and seconds, and "—" for a conversation with no finished review. (agent decision)
