# Decisions

The design starts from ALL-2239 and the plan it cites, `docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks/` (decision 2), both agent proposals. REQUIREMENTS.md 2–4 fix the outcome for each of the three jobs. Invite-goal notifications and per-action stats are required; the user deferred whether this PR fixes daily stats, and how the work is tested and organised, so decision 1 is the agent's and the daily-stats work is optional. The questions were weighed with brainstorm, research and second-opinion subagents per `agents/skills/consult/SKILL.md`; `EVIDENCE.md` holds the research. A later agent may change any decision here that causes friction.

## 1. Scope: all three crons, each with a test that makes the race certain

The PR fixes daily stats, per-action stats and ambassador invite-goal notifications, as ALL-2239 lists. Daily stats is included by the agent's choice: its fix is one insert-or-ignore statement and a test. Each has an e2e test that holds both runs at the racy point, with `rendezvous` (from ALL-2237) or a gate on the repository read, so the race happens on every run instead of by timing. `NotifsService.sendNotifOnce` also has its own tests: two calls held after building their rows, and two recipients sharing a grouping key followed by a repeat call. The tests live in new specs, `test/analytics-overlap.e2e-spec.ts`, `test/notif-send-once.e2e-spec.ts` and `test/ambassador-invite-goal-overlap.e2e-spec.ts`; `test/users.e2e-spec.ts`, where the invite-goal tests were, is within 10 lines of its waiver's ceiling.

## 2. Invite-goal notifications: recheck and save under the grouping key's lock

`NotifsService.sendNotifOnce` builds the row first, then opens a transaction that takes `lockUntilCommit(manager, groupingKey)`, rechecks for a notification with that key through the transaction's manager, and saves only if none exists. The grouping key names the goal and the kind (`ambassador-invite-goal:<goal>:halfway|ended`), so this is the per-goal lock REQUIREMENTS.md 2 asks for. `like-notification.service.ts` already locks on grouping keys the same way.

- The row is built, which reads the member's inbox preference, before the transaction. So the transaction takes no second pool connection while it holds its own, the pattern behind the 2026-11-14 pool deadlock (`docs/provenance/01a1dcda-00fe-72c8-833d-6d724a5377c9-raise-db-pool-size/`).
- The job keeps its existing check before computing the goal's invite stats. That spares the stats queries on every minute's run for the hour an ended goal stays in the lookback window. The check under the lock is the one that decides.
- The push goes out later from the saved row (`notif-push-dispatcher.worker.ts` claims each row atomically), so one row means one push. A save that throws rolls back, nothing was sent, and the next run retries.
- `hasNotifWithGroupingKey` now takes a `params` object with an optional manager, so both checks share one implementation. As before it ignores soft-deleted rows, matching the halfway query's `NOT EXISTS`.

Not chosen, since the user chose REQUIREMENTS.md 2 over them: a partial unique index on `notification` (resolving any duplicates already in production first), and claim columns on the goal (a crash between claim and save loses the notification, and the admin goal edit saves the whole row).

## 3. Per-action stats: one guarded upsert per run, ordered by a computation number

`action_stats_record.computation` is a `BIGSERIAL`, as `action.usersJoinedComputation` is in `docs/provenance/01a1e803-890f-73e6-9dca-95be562e37a7-cron-overlap-delivery-owners/` (decision 5). The reasons carry over: `nextval` issues numbers in order across sessions, `synchronize` creates the sequence in e2e, and a restore keeps the sequence's position. A run takes its number before its first read, then writes every action's row in one `INSERT … ON CONFLICT ("actionId") DO UPDATE … WHERE action_stats_record."computation" < EXCLUDED."computation"`.

- The write is `InsertQueryBuilder` with `orUpdate` and an `overwriteCondition`, over an explicit column list. TypeORM leaves a `generated: "increment"` column out of a Postgres insert that names no columns, so without the list each insert took a fresh, larger number and an older run's write landed (seen in the ordering test). `Repository.upsert` drops `overwriteCondition`, so it can't carry the guard. `STATS_COLUMNS` comes from a `Record` over the row's columns, so a new column fails the build until it is listed.
- Taking the number moved from `ActionParticipantsService` into `src/datasources/computation.ts`, which both callers share.
- One statement replaces a read and a save per action. A run that loses the race no longer aborts its loop over the remaining actions.
- The rows go in `actionId` order, so two overlapping statements lock existing rows in the same order: the second waits for the first instead of deadlocking.
- The admin recalculate endpoint calls the same method, so it gets the same ordering.

## 4. Daily stats: insert or ignore

The job keeps its early return when today's row exists, and inserts with `ON CONFLICT DO NOTHING` (`orIgnore`), so the first run of the day wins, as REQUIREMENTS.md 4 asks. The table's only unique keys are `id` and `dayId`, so ignoring any conflict ignores only a second row for the day.

## 5. The migration carries only the new column

`migration:generate` also emitted drops and re-adds of `friend.lowUserId` and `friend.highUserId` and their index, the same drift from this worktree's database that `docs/provenance/01a1e58f-2580-7098-8fee-732c8e7d9bd0-cron-overlap-member-messages/` (decision 8) removed. Those statements were removed.

## 6. Out of scope, reported

From the brainstorm and second opinion, not part of ALL-2239, each filed in Linear: an invite-goal notification is never sent if the cron is down for more than the one-hour lookback (ALL-2349); the daily-stats job loads every user and their contract events into memory (ALL-2350); action-stats rows for deleted actions are never removed (ALL-1459, filed earlier).
