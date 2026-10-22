---
agent: Claude Opus 5
---

## Measured the `Promise.all` change as a no-op, and reverted it

The user asked to parallelize the sequential visibility-filter loop in
`ActionsService.findMemberPublic`. Implemented, tested green (124 e2e pass),
then benchmarked before/after on identical code and schema:

| concurrency | sequential loop | `Promise.all` |
| ----------- | --------------- | ------------- |
| 1           | 26ms            | 25ms          |
| 7           | 111ms           | 112ms         |
| 14          | 213ms           | 226ms         |

No effect. Cause: `userCanSeeAction` returns before reaching the cohort
evaluation for `public` and `all_members` actions. The dev dataset is 82
public, 11 all_members, 2 participating_groups, so pass one evaluates cohort
expressions for 2 actions. Parallelizing 2 calls buys nothing.

The ~102 table scans per request come from the second pass
(`computeViewerInCohort`, `filterFollowUpFormsByCohort`), which already runs
under `Promise.all`.

Reverted rather than kept: the diff traces to the request, but it changes
behavior-neutral code for no measured gain.

## Measurement corrections made during the task

- An earlier count of "9 table scans per request" was taken against a stale
  dev schema while the endpoint was erroring. The real figure is ~102.
- Benchmarks that did not assert HTTP 200 timed 401 and 500 responses as if
  they were successes, producing several wrong figures. Every benchmark under
  `misc/perf/` now asserts status.
- Staging latency is bimodal under load. Single medians are not reliable
  there; the 90-sample distribution run is.

## Next candidate, not yet implemented

`CohortResolutionSession` declares `formResponsesByFormId`, `tagUserIds` and
`completedActionUserIds`, but the single-user path in
`computeIsInCohortExpression` consults only `usMembershipByUserId`. Every
other leaf issues a fresh query per action. The dataset has 10 actions with
`FormFieldValue` leaves across 8 distinct form ids, and `form_response` is the
most-scanned table, so memoizing those leaves is the next measurable step.
Gate: table scans per request, currently ~102.

## Session memoization of the single-user cohort leaves

Implemented. Three leaves in `computeIsInCohortExpression` issued a fresh
query per action; all three now memoize on `CohortResolutionSession`:

- `completedAction` — was one `findOne` per action, now one `find` per user
  returning the set of completed action ids.
- `inProgressAction` / `missedActionDeadline` — both refetched the same action
  with its events; they now share `loadActionWithEvents`, memoized by action id.
- `matchesFormField` — was one query per action, now one per (user, form).

New maps are keyed by user where the answer is per-user, and kept separate
from the batch path's maps, which hold every user's rows for the same form id.
Sharing an entry between the two would hand one path the other's semantics.

Result, `GET /actions/loggedIn?sorted=true` as a non-admin member:

| metric              | before | after |
| ------------------- | ------ | ----- |
| queries per request | 56     | 45    |
| concurrency 1       | 26ms   | 23ms  |
| concurrency 7       | 111ms  | 101ms |
| concurrency 14      | 213ms  | 199ms |

Query count is exact and repeatable (45/45/45 across runs). The timing gain is
small locally because a localhost query costs ~0.1ms; on staging, where each
query is a network round trip, 11 fewer should carry further.

## Measuring query counts

`pg_stat_user_tables` proved unusable as a gate: background cron workers
generate ~8 table scans per second, which swamps a single 25ms request, and
the stats collector lags the request window.

What works: TypeORM's `AppTypeOrmLogger` already increments a `db_query_total`
Prometheus counter in `logQuery`, exposed at `GET /metrics`. `logQuery` only
fires when the data source's `logging` includes `"query"`, which it does not by
default. Adding it to `logging` in `datasources/dataSource.ts` turns the
counter on; reading `/metrics` either side of one request then gives an exact,
deterministic count. That edit is a measurement scaffold and was reverted.

## `findAllSorted` sort query selects only ids

`findAllSorted` ran the ordering query with `getMany()`, materialising every
`action` column — including `body` and `taskContents` — purely to produce an
order, then refetched the same rows by id with relations. The ordering query
now selects `a.id` alone and reads the result with `getRawMany`.

Verified equivalent: the `/actions/loggedIn?sorted=true` response is
byte-identical before and after (207318 bytes, 77 actions, same id order).

`EXPLAIN (ANALYZE, BUFFERS)` on the two query shapes:

|             | row width | execution |
| ----------- | --------- | --------- |
| all columns | 920 bytes | 0.82ms    |
| id only     | 32 bytes  | 0.28ms    |

Buffers are identical at 28 shared hits, so this removes no I/O — the heap scan
still touches every row. What it removes is width: ~87KB carried through the
hash aggregate and sort and returned over the wire, down to ~3KB.

End-to-end local timing is unchanged, within noise:

| concurrency | before | after |
| ----------- | ------ | ----- |
| 1           | 24ms   | 23ms  |
| 7           | 103ms  | 102ms |
| 14          | 200ms  | 209ms |

That is expected rather than disappointing: on localhost the redundant transfer
is nearly free. The change should carry further against a remote database,
which is where it was aimed. Confirming that needs a staging measurement.

The `!relations` early return went away with the rewrite. All six callers pass
relations, and `find({ relations: undefined })` covers the default.
