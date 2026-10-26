## Fix

The waiver defers splitting a file over the 500-line `alliance/max-lines` limit, so the fix is the split (REQUIREMENTS.md). `StatsPage.tsx` was a stack of independent dashboard sections, so each section becomes a component in `apps/admin/src/components/stats/` that owns its own state, request, and geometry. One commit moves one section, and the page renders the components in their original order.

The page keeps the queries that more than one section reads: the action stats and their recalculation (the aggregate card, the completion bar chart, the completion rate charts, and the action stats table), and the contract status range and history (the aggregate card and the members-over-time chart). One `useActionStats` call keeps the completion rate charts loading while a recalculation started from the bar chart runs. The daily stats range, error, and table stay in the page, which is under the limit without moving them.

Pure calculations move to modules with unit tests: `contractStatusHistory.ts` (last-month churn), `completionRateData.ts` (cumulative and weekly points, y-axis padding), and `reminderClickRateData.ts` (range filter, per-action aggregation, per-channel bars).

## Duplication folded while moving

- The email and text click rate charts were copies differing in title, empty message, and colour. They become one `ReminderClickRateBarChart` rendered per channel, with the per-channel styles in a `Record<ReminderChannel, …>` so a new channel fails the build until styled.
- The cumulative and weekly completion rate charts each padded their y-axis, rendered the Absolute toggle, and listed hovered action names with the same code. Each becomes one implementation, since a change to one should apply to both.

## api-client/named-hooks-only waiver

`StatsPage.tsx` also waived `api-client/named-hooks-only` for its raw client import. Each raw call moves with its section and takes the waiver along: `AggregateStatsCard`, `MissedActionsCard`, `MemberReliabilityCard`, `CohortRetentionCharts`, and `TimeToChurnCard`. Moving them into named query hooks is that waiver's own fix, outside this task, and would change their caching and refetch behaviour.

## Comments

Section-heading comments inside the moved JSX and geometry (`{/* Bars */}`, `// Find closest data point`, …) go, since the component and variable names carry them. The comments about the invisible row hover target and same-day cumulative points stay.

## Tests

`StatsPage.test.tsx` keeps covering the sections it already covered (daily stats, invite funnel, members over time, platform tenure cohort, reminder click rate states) through the page. Sections it rendered only empty get component tests beside them: missed actions, member reliability, aggregate stats, members over time, the completion bar chart, the reminder click rate card, the cohort retention charts and grid, and time to churn.
