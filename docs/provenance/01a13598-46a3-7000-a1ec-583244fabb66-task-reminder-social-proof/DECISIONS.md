# Task-reminder social-proof spec

Status: implemented in `server/src/notifs/reminder-social-proof.ts`, wired into `ActionEventNotifWorker.processOne`. [REQUIREMENTS.md](./REQUIREMENTS.md) contains the authoritative behavior and copy, with origins distinguished. The choices below are agent-authored implementation decisions and acceptance checks.

## Integration

- Identify the three-hour configuration structurally: deadline-relative timing with a 10,800-second offset from the reminder's task deadline. The group's display name and text are editable, so neither identifies the experiment. Dependency-anchored reminders and other timing modes are outside this configuration.
- Apply the personal-reminder distinction already expressed by `cohortNotifiesRecipientPersonally`: incomplete-member, tag, and custom cohorts concern the recipient's tasks; group-lead cohorts concern other members. All still pass through their existing eligibility checks.
- Select copy in the ordinary reminder worker after its send-time task filtering. Use the resulting task IDs for both completion qualification and message count, including optional tasks whenever that group's existing settings include them. This prevents the named claim from referring to a different set than “it” or “them.”
- Keep standard templates on the reminder group and define the variant templates separately. Automatic activation needs no new editing mode, preference, member UI, or preset rewrite. `#{names}` is resolved for the automatic variant; arbitrary authored-template support and preview controls are outside this specification.
- Extend the existing experiment-assignment mechanism with a dedicated experiment, `Experiment.ReminderSocialProof`. Equal probability need not produce an exactly balanced headcount in each batch. Assignment is obtained lazily for an eligible recipient and remains independent of whether lookup later falls back. The single-member `assignExperimentArm` helper serves this experiment and the missed-suite first notice alike.
- Leave a recipient with push and text both off outside the experiment: no arm, no lookup, null social-proof columns. Only those channels carry the variant copy, so an email-only member could never be treated. Eligibility follows preferences, not devices: a member with push on but no registered device keeps their arm and outcome, and the row's pushes show nothing reached them, as for any failed send.
- Draw the arm before the reminder row claims its idempotency key, as the missed-suite notice does, and run the completer lookup after it. A failed draw then claims nothing, so the next tick retries the reminder. Planning re-selects a member whose row is still unsent on every tick, and the claim keeps those passes from rerunning the lookup; the repeated draw is an idempotent insert. The social-proof record rides `recordDelivery`, the post-delivery write, which always runs because an arm implies push or text is on.

## Completion and sampling

- Reuse the canonical latest-completion rule rather than testing for any historical completion row. A later withdrawal disqualifies that member for the affected task; a later completion restores eligibility. Admin-recorded completions use the same rule. Reuse the accepted-friendship helpers, including soft-deletion handling.
- Evaluate candidate eligibility when preparing this reminder's delivery. Form the intersection of current completers across the exact task set, then apply the account and friendship requirements. Current cohort membership, group membership, or an active agreement adds no extra candidate restriction.
- Sample without replacement within the friend-first pools and format the pair as `First Person and Second Person`. Identity is determined by member ID: two people with identical display names remain distinct candidates. Name values are literal text, never additional template instructions: `#{names}` becomes a private-use placeholder before keyword rendering and the names replace it afterwards.
- Resolve one pair before rendering either affected channel. Retain its ordered IDs with the reminder's metadata so another rendering of that delivery does not draw a new pair. A later reminder can select different people.
- Bound the fallback to failures of the additional completer lookup. Log the failure with reminder context through existing logging; transport, assignment-persistence, or core-reminder failures keep their existing handling.

## Stored evidence and migration

- Add the experiment value and nullable social-proof columns on `action_event_notif`: `socialProofOutcome`, `socialProofUserIds`, `socialProofActionIds`. Preserve historical rows as unclassified (null); migration does not infer past exposure, rewrite templates, or enqueue reminders.
- One enum, `ReminderSocialProofOutcome` (`control`, `names_v1`, `fallback_too_few_completers`, `fallback_lookup_failed`), records copy and fallback reason together. Separate copy and reason enums would admit combinations that cannot occur, such as control with a fallback reason; the assignment follows from the outcome and also stays in `experiment_assignment`.
- Retain the outcome, ordered selected member IDs, and the full task-ID set counted in the message, for control and fallback rows as well. The existing `notifiedActionIds` can be narrower than that set, so it alone cannot describe the claim.
- Distinguish standard control, social-proof variant, and standard fallback, with separate reasons for insufficient candidates and lookup error. Couple that decision with existing per-channel delivery outcomes and stored message bodies; a selected template alone is not proof of delivery. Email remains standard even when push or text uses social proof.
- Keep these records within existing staff access boundaries. A per-reminder settings interface, public experiment API, historical backfill, analytics dashboard, and message-tracking context fields add no capability required by this spec.
- The generated migration also carried unrelated `friend` generated-column drift that predates this branch; those statements were removed so the migration changes only this feature's schema.

## Separate late-dispatch issue

Code inspection at `main` commit `98b32e0cbe661040b0c746ba20335dd30485e206` found no deadline recheck between planning a pre-deadline reminder and delivering it. A batch can cross the deadline, after which the formatter returns “0 hours.” No live notification was sent to test this.

Filed [ALL-1621: Pre-deadline reminders can send after the deadline when a dispatch batch runs late](https://linear.app/worldalliance/issue/ALL-1621/pre-deadline-reminders-can-send-after-the-deadline-when-a-dispatch), with a clock-controlled reproduction and code references. That issue owns expiry behavior. [ALL-1069](https://linear.app/worldalliance/issue/ALL-1069) separately tracks incorrect reminder task counts; this feature consumes the existing task list rather than changing that policy.

## Acceptance checks for implementation

1. Existing and newly created eligible groups activate the experiment regardless of their name or custom standard copy. Group-lead, dependency-anchored, and other-timing groups stay on their current path.
2. Repeated reminders and enabled channels reuse a member's experiment assignment. Insufficient candidates and lookup errors leave that assignment intact.
3. A candidate qualifies only after completing the whole counted task set. Cover one task, multiple tasks, disjoint partial completions, unrelated completions, withdrawal after completion, recompletion, and admin-recorded completion.
4. Verify two-or-more, one, and zero eligible friends; accepted friendships in either direction; removed, pending, and declined friendships; and an insufficient combined pool. The sampler never selects the recipient or one member twice.
5. Exclude anonymous, deleted, and blank-name accounts. Include an otherwise qualifying member with a paused agreement, a qualifying member outside the recipient's groups, and two distinct members with the same name.
6. Push and text match the supplied templates for singular and plural task counts and share the selected pair. Names containing template-like syntax remain literal. Text ends with the existing tracked task link.
7. Control and both fallback cases preserve customized standard templates. Email copy, notification preferences, destinations, and the absence of an in-app entry remain unchanged.
8. A recipient with no tasks after the worker's existing filtering receives no ordinary reminder. Qualification uses exactly the tasks remaining after that filtering, including its optional-task and previously-notified settings.
9. Lookup failure produces standard delivery and an error record distinguishable from a valid undersized pool. Core delivery errors continue through the existing handling.
10. Stored records distinguish assignment, selected copy, actual channel delivery, fallback reason, selected people, and the full task set. Historical rows remain unclassified and migration sends nothing.
11. Scheduling, late-dispatch behavior, and once-only delivery retain their existing semantics. Run focused server tests, package typechecking, duplication checks, and coverage review.

Checks 1–6 and 8–10 are covered by `server/src/notifs/reminder-social-proof.spec.ts` and `server/test/reminder-social-proof.e2e-spec.ts`; 7 and 11 rest on the existing worker and missed-suite e2e suites passing unchanged. Group-lead and anchored exclusions are covered at the unit level only.
