# Split FormResponseStatistics under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

- The waiver was picked because no in-flight branch touches `FormResponseStatistics.tsx`, so the split conflicts with no parallel work.
- The fix is splitting the file along the boundary between computing statistics and rendering them, with no behavior change. Layout, from the options `codex exec` proposed per the repo's file-size rule:
  - `apps/admin/src/lib/fieldStatistics.ts`: the field kinds that get statistics, answer-to-number parsing, and the per-kind counting in `buildFieldStats`.
  - `apps/admin/src/lib/numberStatistics.ts`: number-field summaries and bucketing, the number formatting both the buckets and the summary display use, and the `StatRow` and `NumberSummary` types. The types live in this lower-level module so it imports nothing from `fieldStatistics.ts`, which calls it.
  - `FormResponseStatistics.tsx` keeps field selection, memoization, and all rendering.
- Function bodies move unchanged. `toNumberValue` stays separate from `toNumber` in `responses-table/sorting.ts`: that one keeps `Infinity`, which statistics drop.
- The extracted computation gets its own unit tests, since the component test only covers saved formula choices on a multiselect.
- One commit: neither extraction alone brings the component under the limit.
