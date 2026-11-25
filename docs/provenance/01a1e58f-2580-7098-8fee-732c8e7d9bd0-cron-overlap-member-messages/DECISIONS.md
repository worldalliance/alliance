# Decisions

The user deferred which issue this PR takes ("whichever you want"), so the scope and every choice below are the agent's; a later agent may change one that causes friction. What the user deferred is how the work is done, not whether it happens.

The design comes from ALL-2237 and the plan it cites, `docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks/` (decision 6 and "Order of work" in `DECISIONS.md`). Both are agent proposals the user has not approved point by point.

## 1. This PR is ALL-2237

ALL-2234 (step 1 of the plan) is done and ALL-2236 is blocked by ALL-2235, whose three sub-issues have no priority or order set. ALL-2237 covers the overlaps that reach members twice: contract reminders, forum autocomplete, contract suspensions and action-event notifications. ALL-2238 and ALL-2239 stay for later PRs.

## 2. Each job stays correct with no lock at all

The advisory locks stay. Each cron's body moves into a public method (`sendDueReminders`, `autocompleteDue`, `suspendDue`, `dispatchDue`) that the `@Cron` method runs under the lock. The tests call the body twice at once without the lock, which is the state a lease takeover produces (ALL-2236).

## 3. Contract reminders: a conditional claim

Each member is claimed with `UPDATE … WHERE contractReminderSentAt IS NULL`, and the send happens only when that update affects a row. A send that fails with `MailNotSentError` clears the column again. No other run can claim the member between this attempt's claim and that release, since the column is set the whole time, so the release needs no owner check and no column is added. Nothing else writes `contractReminderSentAt`.

## 4. Forum autocomplete: atomic create-if-absent in `createActionActivity`

The duplicate check and the insert in `ActionActivityService.createActionActivity` run in one transaction under `pg_advisory_xact_lock(hashtextextended('action-activity:<action>:<user>:<type>', 0))`, the transaction-level form already used in `prerequisite-validation.ts` and `like-notification.service.ts`. A duplicate throws `ActivityAlreadyExistsException`, which keeps the existing `BadRequestException` message for API callers. The worker treats it as a lost race: it skips the event log and moves on, where before it aborted the pass. The lock holds no connection beyond the transaction's own. The inline `hashtextextended` query follows the existing call sites; a shared helper that also asserts an active transaction belongs with moving all of them to it, scope this PR leaves to ALL-2278.

Not chosen: a partial unique index on `(actionId, userId, type)`. Rows that `ALLOW_DUPLICATE` permits, and any duplicates already in production, would need a data migration first. The fix applies to every caller of `createActionActivity`, member completions included, because they share the same check-then-insert.

## 5. Contract suspensions: commit under a per-member lock before outside effects

`ContractService.suspendContract` takes `pg_advisory_xact_lock(hashtextextended('contract-suspension:<user>', 0))` inside its write transaction, re-reads the member's contract events, checks the contract is active, stamps the date and inserts the event. Only after that commits does it remove the member from their communities, which notifies leaders; before, both ran in parallel. A losing run throws before any outside effect, and the worker logs it and moves on. Signing does not take this lock, so the signing races in ALL-1850 remain.

## 6. Action-event notifications: reservations count as coverage

`action_event_notif` gains `deliveryPending` (boolean, default false). A reminder row is inserted with it set, and it is cleared when delivery returns, by `recordDelivery` when anything went out and by an explicit update otherwise. Coverage counts rows that are sent or pending, both at send time (`findNotifCoverage`) and in the planner (`findAlreadyNotifiedUserIds`), so the two agree. Reading coverage and inserting the reservation happen in one transaction under `pg_advisory_xact_lock(hashtextextended('reminder-coverage:<user>:<member event>', 0))`, taken by every reminder whose row counts as coverage (every cohort but group leads). A reminder that ignores coverage still takes it, so a catch-up in an overlapping run can't read coverage while that reminder's reservation is inserted but not committed. Only `excludePreviouslyNotified` groups re-read coverage under it. The pre-check outside the transaction stays, so a member who is already covered still gets no social-proof arm assigned. Missed-suite notices also count as coverage, but only once sent: they take no lock and set no `deliveryPending`. That predates this work and can't occur while the global lock serialises runs, so it is ALL-2293, to land before ALL-2236.

A reminder left pending because sending threw or the process died keeps counting as coverage. This follows the policy in ALL-2237 and the spec that a send which may have reached the provider stays uncertain and is not retried. The user has not stated that policy (agent proposal, from the forwarded issue). A failure thrown before anything could reach a provider is not uncertain, so it releases the reservation: `ActionEventNotifDeliveryService.prepare` renders every channel and looks up push devices before it returns the function that sends, and a throw from social proof or `prepare` clears `deliveryPending`. Without that, a render or database error would suppress the member's catch-ups on that event forever with nothing sent.

Not chosen: counting every unsent row as coverage. That would let a sibling's failed or empty send suppress a catch-up, which `still sends the catch-up when the sibling plan in the same cycle never actually sent` rules out.

## 7. The forum autocomplete spec splits along fixtures and recovery

The new overlap test would have pushed `server/test/forum-action-completer.worker.e2e-spec.ts` past its 650-line baseline waiver. A codex subagent proposed splits; this follows its option 2 with one change. Shared builders and cleanup move to `forum-action-completer-fixtures.ts`. The decision, recovery and overlap tests move to `forum-action-completer-decisions.e2e-spec.ts`, which keeps `createUndecidedForumAction` local. Both specs are under 500 lines, so the waiver is gone.

## 8. The migration carries only the new column

`migration:generate` also emitted drops and re-adds of `friend.lowUserId` and `friend.highUserId` and their index. That drift comes from this worktree's database and is unrelated, so those statements were removed. After the migration ran, a fresh generate showed nothing for `action_event_notif`.
