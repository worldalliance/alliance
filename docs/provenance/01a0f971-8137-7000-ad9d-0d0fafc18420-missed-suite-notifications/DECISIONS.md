# Missed-suite notifications

## Streak and timing

Use one chronological calculation for first-miss eligibility, second-miss eligibility, suspension, and admin suspension previews. The user approved requiring the current streak; scanning for any historical run can suspend a member after a later satisfied suite has reset it.

Evaluate closed suites in deadline order. A member's suite is satisfied when every required assignment has a completion or accepted withdrawal; any remaining required assignment makes it missed. Count only assignments in the current signing period, using existing contract-window and away eligibility. Skip suites with no required assignments. Count a saved completion without rejecting it retrospectively because of its timestamp or the action's current late-completion setting.

For unequal action deadlines, use the latest required-action deadline in the suite and send once per member/suite, naming only that member's missed required actions. Send only after every required action has a deadline and the final deadline has passed. A trigger that fires earlier is retried on each worker run within the existing three-hour lookback window, then dropped with a logged warning. Extending the reminder scheduler to wait indefinitely would have cost more than this case warrants. The user expects unequal deadlines not to occur and explicitly placed this fallback in decisions rather than requirements.

An accepted late completion changes the historical suite's outcome when all its required actions are satisfied. Recalculate subsequent misses: completing an older suite does not erase misses after that suite. Preserve the existing contract lifecycle; completion does not automatically reinstate an already suspended agreement.

Process future due notification events automatically, using existing scheduling and failure handling. Existing history informs streaks immediately, but do not backfill notifications for every historical missed suite. Do not introduce rollout-date state or a new grace period.

## Completion permission and dismissal

At ordinary completion submission, reject an action whose deadline has passed unless `shouldCompleteAfterDeadline` is enabled. Reuse the same permission calculation for API availability fields consumed by web and mobile. Keep existing cohort and `preventCompletion` checks and the explicit staff correction override. Revalidate at submission so a form opened before the deadline cannot bypass the rule. Preserve accepted historical completion records.

Keep dismissal as a display overlay throughout affected assignment, notification, and suspension paths; filtering dismissed cards from the home page must not remove their required work from the missed-task list. This is broader than merely changing the suite's all/any predicate and has a separate rollout impact below.

## Delivery and experiment records

Use a stable per-member experiment assignment persisted in the database. Allocate control/variant with equal probability, retaining the same assignment across channels, suites, and re-signing. Store enough information to join each notification to member, suite, miss number, copy variant/version, channel, delivery outcome, and send time. Reuse existing delivery entities where possible; the user wants manual review, not a new analytics dashboard.

Keep configured first-miss control copy, except any necessary correction of an obsolete suspension-policy claim. Second misses bypass the experiment and use the selected report copy. Add in-app entries for both groups, with existing push text for the control. Reuse the existing notification list and tasks destinations on web/mobile.

Scope notification deduplication to member and suite so an action-level reminder cannot send a second missed-suite notice. Use one in-app entry and one attempt per external channel under the existing delivery semantics; do not dispatch a second push through both the reminder sender and the in-app notification pipeline. Preserve existing failure and retry behavior. A failed or disabled delivery channel does not exempt the member from suspension.

Use the existing singular/plural template mechanism for `#{it|them}` based on the number of missed tasks in this message. Preserve the supplied email subjects and SMS trailing `#{link}`. In particular, the user chose to retain “Completing this week's task resets the count” rather than the agent's proposed copy rewrite; the actual reset still requires satisfying all assigned required actions.

Update shared agreement text, member-facing policy explanations, and suspension notices to describe missing any required action over three consecutive assigned weeks. Do not change existing signatures or require renewed acceptance. Integrate automatic events with existing admin inspection where available; no new admin editor, per-suite setup, or experiment dashboard is planned.

## Staging comparison — 2026-10-01

The agent streamed a fresh staging snapshot into the separate local database `alliance_missed_suite_audit_20261001`, preserving the development database. No dump file or member-level results were saved in the repository. The analysis used saved cohort decisions, existing contract and away predicates, and completion/withdrawal activities. Every closed required action had saved cohort decisions; no live-cohort fallback was needed. Snapshot counts are not a guarantee of production rollout counts.

| Measure                                                                             | Count |
| ----------------------------------------------------------------------------------- | ----: |
| Members in snapshot                                                                 |   663 |
| Members with active agreements                                                      |   221 |
| Closed required suites                                                              |    50 |
| Eligible member/suite observations                                                  | 4,972 |
| Members with at least one partial suite, ignoring dismissal                         |    31 |
| Partial member/suite observations                                                   |    36 |
| Members with partial misses but never an entirely missed assigned suite             |     2 |
| Active members with partial suites since their latest signing                       |    12 |
| Partial observations for those active members                                       |    14 |
| Current suspension candidates                                                       |     0 |
| Candidates after only the all/any change, retaining dismissal exclusion             |     0 |
| Candidates after all/any plus ignoring dismissal, retaining historical-run scanning |     4 |
| Candidates after both changes, requiring the current missed streak                  |     1 |

The analysis reproduced the existing service's expected and failed member/suite sets with zero mismatches, and its suspension scanner confirmed the 0-current/4-combined candidate counts. Three of the four combined candidates have a later reset; only one has a current trailing streak of at least three.

Re-signing already excludes older misses; the observed bug is an old three-miss run within the same signing period. A synthetic call to the existing scanner with three misses followed by a satisfied suite still returned a suspension candidate. Its equivalence to checking the current streak depends on suspension having already run before the later reset, which may not hold after worker downtime or when changing historical classification.

## Acceptance checks for implementation

1. A suite with two assigned required actions, one satisfied and one missed, increments the streak. Satisfying both resets it. An optional or unassigned action neither causes a miss nor satisfies required work.
2. Away periods, onboarding exclusions, contract-window eligibility, accepted withdrawals, and suites with no required assignments retain the approved semantics. Dismissal changes only home-page visibility.
3. The current third consecutive missed assigned suite causes suspension. Three older misses followed by a satisfied suite do not. Re-signing clears prior misses; later qualifying misses can still trigger suspension. Admin previews and warning counts use the same chronology.
4. A permitted late completion updates its suite and recalculates later misses. Existing late records remain valid. Completing only part of a missed suite does not reset it.
5. Ordinary late completion is rejected with late completion disabled, including a submission from a previously opened form. Enabling it permits an otherwise eligible submission. Staff correction remains available. API flags, web, and mobile agree.
6. First-miss variants retain stable database assignments across repeated misses and channels. Records support manual comparison of delivery and later participation. Both groups receive their respective in-app copy.
7. First- and second-miss notices are mutually exclusive for a suite; third-miss processing sends only the suspension notice. Multiple actions and worker reruns do not duplicate the notice or its push. Optional and dismissed-card handling cannot contaminate the task names or plural count.
8. Approved channel preferences, copy, explicit email subjects, tasks links, and existing failure behavior are preserved. Agreement and suspension wording accurately describe the new rule without requiring re-signing.

Start implementation with regression tests for partial suites, historical versus current streaks, dismissal, and prohibited late submission.

## Implementation choices

**Trigger.** Missed-suite notices are triggered by the existing per-suite "Missed deadline" reminder groups. These are the admin preset, and production already has them configured for upcoming suites. A group is treated as a missed-suite trigger when its email subject or body contains `#{missedactioncontext}` or `#{secondmisswarning}`, which is the same rule the worker already used to personalize these messages. This choice reuses existing scheduling, failure handling, and admin inspection. It also makes the group's configured text the first-miss control copy. If a suite has no such group, it gets no notice. A group with no suite logs an error and is skipped. `#{secondmisswarning}` now only marks a group and renders empty, since the second miss sends its own copy.

**Chronology.** `server/src/actions/missed-suite-streak.ts` holds the pure streak rules. `ActionsService.buildSuspendPlanContext` produces each closed suite's missed required actions per member. Suites are ordered by close date (the latest required-action deadline), with suite id breaking ties; the old code ordered them by action priority. A suite closes when `deadline <= now`, matching `hasMemberActionDeadlinePassed`; the old suspension check used a strict `<`. An assignment counts toward the current signing period when its member-action phase starts after the member's latest signing, as before. The missed-deadline copy's first-assigned-suite check (`#{missedactioncontext}`) reads the same period, so a member who re-signs gets the newcomer copy on their next miss, matching the streak reset on re-signing. The suspension reason key is the first three suites of the current run, so it stays stable as the run grows and the `(user, autoSuspendKey)` constraint still deduplicates. The admin suspension preview (`getSuspendPlans`) uses the same context.

**Warning counts.** "Warning counts" is read as the miss number that selects first- or second-miss copy. The admin stats panel "Missed last action / Missed last two actions" (`AnalyticsService.getMissedActions`) is action-level analytics with its own contract, so it was left unchanged.

**Dismissal.** Dismissal is removed from the roster predicate (`computeIsAssignedFromCohortSet`) for every caller: reminder cohorts, suspension, participant counts (`usersJoined`), and analytics rosters. One rule keeps these surfaces consistent with the requirement that dismissal affects only home-page visibility. The reminder task list (`findUncompletedTasks`) reads `viewer.assigned` instead of the legacy `shouldParticipate`. The legacy `shouldParticipate` field still folds in dismissal, because it controls home-page visibility for clients that predate `viewer`.

**Late completion.** The rule is enforced in `computeCanCompleteAction`, which feeds `canParticipate`, `viewer.canComplete`, the welcome queue, and the completion gate. The deadline is `memberActionPhase.deadlineEvent`, the same deadline the viewer's `deadlinePassed` uses. `submitForm` now checks permission before it applies any answer side effects (contract signing, profile updates, the saved response), so a late submission leaves nothing behind. The admin `createActivity` endpoint and the forum autocompleter keep the `adminCreated` bypass. No client changes were needed, because web and mobile already gate on `canComplete` and status.

**Records.** `experiment_assignment` stores `(userId, experiment)` uniquely. The arm is drawn 50/50 with `crypto.randomInt` the first time a member is due a first-miss notice, then reused. Notices are `ActionEventNotif` rows with type `misseddeadline`, `actionSuite`, `missNumber`, `missedSuiteCopy`, and `notification` (the in-app entry), alongside the existing mail/mms/push delivery records and `createdAt`. Copy values carry a version suffix (`first_miss_report_v1`), so rewording a report copy adds a value rather than changing what past rows mean. Control rows join to their configured text through `reminderGroupId`. The idempotency key `missed-suite:{suiteId}:{userId}` is claimed before anything is sent. A member the group plans but sends nothing to (a third miss, or a suite that did not count as missed for them) still claims the key with an unsent row whose copy is null, so sibling groups and later cycles drop them before reloading suite history. `notifiedActionIds` lists the named missed actions. The row is not stamped with `memberActionEvent`, so it does not feed the catch-up coverage that `excludePreviouslyNotified` reads.

**Channels.** The in-app entry is a `Notification` with category `action_event` that links to `/tasks`, with `shouldPush: false`. The reminder sender delivers the push with screen `/`, the mobile tasks screen and the same screen ordinary reminders open, so the in-app pipeline cannot dispatch a second push. External channels follow the existing per-channel preferences and failure behavior. The report email bodies keep the source's line breaks (single newlines).

**Suspension push.** The suspension notice sends a push alongside its SMS and email, gated on the member's action-push preference. It reuses the SMS sentence (`suspensionMessage`) so the two channels cannot drift, and opens `/membership`, where a suspended member can re-sign. Its idempotency key includes the suspension reason key, so a member suspended again after re-signing gets a new push.

**Copy correction.** A data migration replaces the obsolete sentence ("miss all of your assigned non-optional actions for three weeks in a row") in reminder groups whose deadline is still ahead. Groups past their deadline keep the copy they went out with; `allSent` is never set, so it cannot tell sent groups apart. The admin preset default, the `#{secondmisswarning}` text, the suspension SMS/email, the shared contract term, and the explanation pages now say "miss any assigned non-optional task for 3 weeks in a row". The stored contracts in the local snapshot do not contain the suspension clause, so no contract record changed.

**Removed.** `server/scripts/local-test-missed-action-emails.ts` checked the old personalized second-miss email through the removed `getMissedActionReminderContexts`, so it was deleted.
