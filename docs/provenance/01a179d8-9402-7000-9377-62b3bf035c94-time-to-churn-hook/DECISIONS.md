## The hook

`useTimeToChurnSamplesAdmin` sits in `apps/admin/src/lib/` beside the stats page's other one-endpoint hooks (`useAggregateStatsAdmin`, `useUserCityCountsAdmin`), keyed by `queryKeys.timeToChurnSamplesAdmin()`. Nothing writes the samples, so the hook is a read with no invalidation. It keeps the admin query defaults, as `useAggregateStatsAdmin` does: the card loads on mount like that one, unlike `useMissedActionsAdmin`, whose opt-outs of refetch and retry guard a click-triggered costly query.

## The card

The card reads through the hook and the TODO lint disable goes. A failed load used to log to the console and show "No churned members yet."; it now shows "Unable to load time to churn." (or the server's refusal, through `adminRefusalMessage`) and hides the member count, per the root `AGENTS.md` rule to fail loudly. A failed refetch drops the samples too, so a stale histogram doesn't sit beside the error, matching `MissedActionsCard`.
