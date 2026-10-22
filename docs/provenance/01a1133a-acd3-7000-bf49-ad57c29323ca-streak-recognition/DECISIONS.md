# Streak recognition

The approvals in [REQUIREMENTS.md](./REQUIREMENTS.md) constrain this design. The details below derive their delivery behavior and acceptance checks; they do not authorize implementation.

## Counting

Reuse existing assignment, presence, signing-period, and action-status rules. Evaluate closed suites in deadline order, breaking equal deadlines by suite ID as the existing suite calculation does. A suite closes at the latest deadline among its required, non-onboarding actions; a required action without a deadline leaves it open. Each suite contributes at most one increment, regardless of its duration or task count.

For each suite, consider only this member's required, non-onboarding assignments in the current signing period. Exclude withdrawn tasks using the existing completed/withdrawn status interpretation. Classify the remaining obligations:

| Remaining obligations            | Effect                                  |
| -------------------------------- | --------------------------------------- |
| At least one task, all completed | Increment by one                        |
| At least one task incomplete     | Reset to zero                           |
| None                             | Preserve the count without incrementing |

Optional tasks, dismissal, and follow-up submissions cannot earn a completed suite. Admin-recorded completions qualify under the same completion rules. Completion timestamps are not compared with deadlines: a late completion can therefore change the recomputed streak. Recalculate before preparing a due recognition and retain the count used for that delivery across its channels. Changes afterward do not rewrite delivered copy.

Do not derive success solely from the existing missed-suite result: it treats both completion and withdrawal as satisfying an obligation and cannot distinguish an entirely withdrawn suite from a completed one. Reuse its assignment and ordering rules while retaining enough activity information to make the distinction above. Suspension behavior is outside this change.

The whole Onboarding suite is excluded independently of its actions' onboarding flags. In the inspected staging data this is suite ID 1, including two historical actions whose flags are false. Identify that suite deliberately during implementation; a task's flag alone is insufficient.

History is not restricted to post-deployment completions. The current signing period remains the boundary, so signing again after a pause begins a new streak. Historical corrections affect future eligibility, while exposure records prevent repeating recognition already delivered for a run.

## Preset and eligibility

The new preset uses the existing Two Day Range timing and audience: unfinished suite tasks, scheduled 24–48 hours before the reminder's deadline at the member's preferred reminder time. Preserve its task filtering, optional-task inclusion, countdown formatting, links, and delivery scheduling. A member with no remaining tasks receives no reminder through this preset.

At delivery preparation, recognition requires all of the following:

- The saved suite reminder uses the new preset's recognition behavior and is due under the existing scheduler.
- The member's current completed-suite count is exactly 2, 3, or a positive multiple of 5.
- That milestone has not already been recognized within this streak.
- The member is assigned to the variant.

The first recognition celebrates two closed suites while a subsequent suite still has unfinished tasks. The three-suite milestone similarly celebrates three already completed suites. A count of seven does not send delayed recognition for five; it next qualifies at ten. A neutral suite preserves the count, and deduplication prevents it from causing repeated recognition. A new streak can earn the same milestones again.

When recognition is ineligible, send the reminder's ordinary control copy through its ordinary channels. After one qualifying reminder recognizes a milestone, other reminders keep their ordinary behavior. Absence of the preset creates neither a separate notification nor a queued catch-up campaign.

Store the recognition behavior explicitly with the saved reminder so names and copy edits cannot accidentally enable or disable it. The preset picker offers **Streak recognition**, and **Populate default reminders** uses it in the Two Day Range slot. Keep the ordinary Two Day Range preset available. Applying the new preset to an existing reminder enables it; deployment itself leaves existing saved reminders and sent notifications unchanged.

## Copy

The recognition sentence is:

> You have completed #{streakcount} weeks of tasks in a row!

`#{streakcount}` is the number of completed suites in the current run. The weeks wording denotes assigned suites rather than elapsed calendar weeks.

| Channel         | Recognition variant                                                           |
| --------------- | ----------------------------------------------------------------------------- |
| Push and in-app | Recognition sentence, a space, then the ordinary reminder push copy           |
| SMS             | Recognition sentence, a space, then the ordinary reminder SMS copy, unchanged |
| Email subject   | Recognition sentence only                                                     |
| Email body      | Ordinary reminder email body, unchanged                                       |

For the preset's standard SMS suffix, retain `You have #{timeremaining} left to complete #{n} Alliance task#{s} (#{link})`. The standard push suffix is the same reminder sentence without the parenthesized link. Resolve the remaining tokens through the existing reminder renderer. Control and non-qualifying reminders retain their ordinary subjects and bodies.

The user's final email and SMS instructions are explicit exceptions to the proposal's global first-body-sentence subject rule and bare-link SMS rule. Preserve the existing task destination and tracking behavior.

## Experiment, channels, and records

Reuse persistent per-member experiment assignments with a separate experiment identity and equal allocation. A member keeps the same arm across reminders, streak resets, and channels, independently of other notification experiments. Eligibility changes do not reassign the member.

Create an in-app entry only when recognition is selected. It uses the recognition push copy and the existing task destination, visible through the web and mobile notification lists. Email, SMS, and push each follow existing action-notification preferences and device/contact eligibility. The in-app entry does not depend on enabling an external channel. Ordinary control/fallback delivery creates no new in-app entry.

Record the assigned arm separately from the copy actually used: a variant member below a milestone receives ordinary copy. Retain the streak count, run identity, target suite/reminder, and per-channel outcomes for comparison with subsequent completion. Deduplicate milestone recognition across reminder groups and worker reruns; multiple enabled channels belong to the same recognition. Follow existing delivery failure handling and retain failures in the outcome records, without creating a separate retry campaign. New reporting UI, new click/open instrumentation, and interaction with social-proof item 6 are outside scope.

## Evidence affecting the design

A read-only staging inspection during this interview found that suites cannot safely be grouped or counted by calendar week: suite 7, **Week 6: Report a pothole**, ran November 10–24, 2025; suites 12 and 13 shared December 29, 2025–January 5, 2026. The regular suites from April 14 through October 6, 2026 follow a weekly cadence. Count distinct assigned suites, including the historical exceptions, instead of merging equal deadlines or requiring seven-day durations.

Existing suite-outcome calculation loads completion/withdrawal records without filtering their timestamps by deadline, confirming the user's requested late-completion behavior. This evidence establishes current behavior, not its original intent.

## Acceptance checks

Implementation is complete when focused tests and repository checks establish:

1. Multiple required completions in one suite increment once; optional/onboarding completions cannot increment; the Onboarding suite is excluded even when an action's onboarding flag is false.
2. Completion plus withdrawal counts; all withdrawals and other zero-obligation suites are neutral; one remaining incomplete requirement resets the count. Dismissal and follow-up activity do not satisfy a task.
3. Late and admin-recorded completions qualify. A late correction can change a future streak without rewriting a delivered message. Open suites are excluded, and equal-deadline suites remain distinct and deterministically ordered.
4. Excused time away and unassigned suites preserve a run; a new signing period resets it. Pre-deployment history contributes within that period.
5. Counts 2, 3, 5, 10, and 15 select recognition for eligible variants; counts 0, 1, 4, 6, and 7 use ordinary copy. Recognition requires an existing due reminder using the new behavior and unfinished tasks under its existing filters.
6. One run recognizes each milestone once across duplicate groups, neutral suites, and worker reruns. Later reminders retain ordinary behavior; a new run can recognize the same milestone again.
7. Populating defaults uses the new preset in the existing slot. Existing saved reminders remain ordinary until an admin applies it, and deployment sends nothing. A suite without the preset sends no recognition.
8. Assignment is stable, independent, equal-probability, and shared across channels. Controls and ineligible variants retain ordinary copy and no added in-app entry.
9. Recognition matches the Copy table, including singular/plural task suffixes, suite counts, unchanged email body, unchanged SMS suffix, and existing link destinations. The optional-task count and preferred timing match the ordinary preset.
10. Each enabled external channel follows its existing eligibility rules; disabled channels do not send. Recognition creates one in-app entry available on web and mobile, including when all external channels are disabled.
11. Records distinguish assignment from actual copy and expose the target suite, streak, and channel outcomes without a new analytics interface.

## Implementation choices

- **Counting** extends the existing suite-outcome calculation (`ActionsService.buildSuspendPlanContext`) instead of building a second one. Each `SuiteOutcome` also records which keyed members completed something, using the latest terminal activity per action (`findLatestTerminalActivity`), and whether the suite is the Onboarding suite. `completedSuiteStreak` classifies each suite: any missed requirement resets; otherwise a completion increments; otherwise (all withdrawn) it's neutral. Suspension and missed-suite notices read the same data and are unchanged.
- **Onboarding suite** is identified by a new `ActionSuite.onboarding` column. The migration sets it on the suite named exactly `Onboarding`, which is suite 1 in staging. There is no admin control for it; another environment needs a one-row update.
- **Run identity** is the first suite of the current run. A late correction that merges or splits runs can change it, so a milestone can occasionally be recognized again under the new identity; the requirements accept late corrections changing future eligibility.
- **Exposure records** are the reminder's own `ActionEventNotif` row, which already holds the target suite, per-channel mail/SMS/push outcomes, and the in-app entry. New columns `streakCount`, `streakRunSuiteId`, and `streakRecognitionCopy` (`control` or `recognition_v1`) sit alongside a partial unique index on `(user, streakRunSuiteId, streakCount)`. Dispatch checks for an existing claim under the worker's advisory lock, and the index catches anything that slips past it. Both arms claim a milestone, so after a control member reaches one their later reminders also stay ordinary, which keeps the arms comparable.
- **Assignment** uses `Experiment.StreakRecognition` with `assignExperimentArms` (50/50, persistent). An arm is drawn only when a member reaches an unclaimed milestone on a flagged reminder. A member below a milestone gets ordinary copy with no arm drawn and no streak record; the arm lives in `experiment_assignment`, and the copy actually sent is on the notif.
- **Group-leads cohorts** never recognize: their reminders are about other members' tasks.
- **Copy**: the count is interpolated straight into the recognition sentence rather than adding a `#{streakcount}` keyword to the renderer. The rest of each template still goes through the existing renderer.
- **Preset and admin UI**: the **Streak recognition** preset spreads **Two Day Range** and sets `streakRecognition: true`, so the two can't drift apart. The reminder form has a **Streak recognition** checkbox. Presets only apply on create, so the checkbox is how an admin enables recognition on an existing reminder. The reminder card notes when it's on. `CreateReminderGroupDto.streakRecognition` is optional: omitting it creates a group with the flag off and leaves an existing group's flag unchanged.
- **In-app entry**: creation is shared with missed-suite notices (`sendReminderInAppEntry`).
- **E2E timing**: the e2e spec makes reminders due with `from_deadline` timing. Recognition depends on the saved flag, not the timing mode, and preserving the Two Day Range timing is covered by the preset spreading it.
