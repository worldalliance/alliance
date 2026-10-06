# Action-update recognition spec

Status: implemented. [REQUIREMENTS.md](./REQUIREMENTS.md) distinguishes user-origin requirements from approvals of agent proposals. The behavior below consolidates those decisions. Acceptance checks are agent-authored consequences of them.

## Audience and experiment

Keep the admin's existing audience choices and explicit send flow, including visibility and scheduling restrictions. Publication alone does not send a notification. Completion controls wording within the selected audience; it does not add recipients.

Use one independent, persistent experiment assignment per member with equal probability of A and B. Reuse that assignment for every recognition update and enabled channel. This follows the existing persistent-assignment model and makes exposure consistent across updates. Equal probability does not require an exactly balanced headcount in each audience.

At delivery preparation:

| Completion event for this action  | Stored assignment | Delivered branch |
| --------------------------------- | ----------------- | ---------------- |
| Present, including admin-recorded | A                 | A                |
| Present, including admin-recorded | B                 | B                |
| Absent                            | Either            | B                |

Late completion counts if the event exists when eligibility is frozen. A completion the member later withdrew from does not count: as everywhere the app reads a member's status, their latest completion or withdrawal decides. A later completion does not cause another notification. A/B assignment remains distinct from the branch actually delivered, so a member temporarily ineligible for A retains their assignment.

There is no third old-copy arm for new updates. This approved choice replaces the proposal's general instruction to retain old copy as an experiment control.

## Authoring and transition

Store a notification mode, normal contribution formula, retrospective contribution formula, and static collective-result string on each update. Reuse the existing variable builder and evaluation semantics, with inputs scoped to the member's answers for this action. The completion event's linked form response is the answer source. Contribution fields belong to the update because separate updates may report different outcomes.

Each update selects normal or retrospective mode explicitly. Time since completion determines the retrospective number, not the mode. Only the selected mode's contribution formula is required and evaluated. The two grammatical forms are independent; for example, synthetic normal wording “3 letters” and retrospective wording “sent 3 letters.” These notification fields do not personalize the published update body.

Preserve the legacy notification path for all updates that exist at deployment, including unsent drafts and scheduled notifications. Mark that boundary during migration rather than relying on a mutable displayed date. New updates must use one of the two recognition modes; their editor and API cannot opt into legacy copy. Migration does not enqueue or resend anything.

Keep the current admin links and send interface. The user's response to the expanded preview proposal was to keep existing behavior; therefore, the only preview expansion required here is the approved contribution validation and affected-member feedback, not a new all-channel member-preview interface or audience dashboard.

## Validation, freezing, and delivery

Validate required configuration and formula structure before allowing a send. Evaluate the active contribution formula for each audience member who would receive A. Show the affected members and evaluation errors or empty output in admin. Missing or invalid raw answers are allowed if the authored formula resolves them into valid, nonempty wording. Authored fallbacks preserve both the intended copy and the experiment assignment.

An invalid or blank final contribution blocks the update's send. Do not send broken copy, skip affected members, or silently switch them to B. Keep drafts editable so the admin can fix the formula or author a fallback. The inactive contribution field and missing answers for B recipients do not block sending.

Revalidate scheduled sends when they become due. If validation fails, hold all notifications for that update and expose the reason in admin. The hold is repairable without creating another update. Delivery preparation must complete validation before releasing any channel, so a validation failure cannot leave a partially sent update.

Freeze eligibility, the linked response's resolved contribution, the collective result, retrospective elapsed time, and actual branch together when the update becomes due for delivery. Use the stored experiment assignment. Retries and later channel deliveries use that frozen content; subsequent answer or copy edits do not rewrite it. Preserve once-only delivery per update, recipient, and channel through retries and validation recovery.

Create the in-app entry for recipients using their selected branch. Deliver independently through each enabled external channel using:

- Existing action email preference for email.
- Existing action SMS preference for text.
- Existing action-update push preference for push.

Retain existing channel eligibility checks and transport failure handling. No new preference keys or settings UI are required. Reusing existing choices lets members receive updates through channels they already enabled. Preserve the current action-page destination and existing channel-appropriate link handling.

## Copy and elapsed time

Normal copy is defined once in REQUIREMENTS. Treat all resolved values as text and escape them appropriately for each channel.

In retrospective mode, branch A uses the following content body, where `retrospective_contribution` names the separate authored field:

| Elapsed time since completion | Content body                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Less than one whole week      | Recently you #{retrospective_contribution}. #{alliance_result}.              |
| One whole week                | 1 week ago you #{retrospective_contribution}. #{alliance_result}.            |
| Two or more whole weeks       | #{weeksago} weeks ago you #{retrospective_contribution}. #{alliance_result}. |

Compute whole weeks as elapsed seven-day intervals from the completion timestamp at delivery preparation. Use that frozen value across channels. Push and in-app contain the content body. SMS appends a space and the link. Email adds `Hi #{firstname},` before the body and the link afterward. Its subject is the first content sentence, excluding the greeting. Branch B uses its normal copy regardless of mode because it does not attribute a personal contribution.

## Measurement

Record the member's persistent assignment separately from the delivered branch. For each update exposure retain mode, completion eligibility at the snapshot, and channel delivery outcomes. Eligibility distinguishes B assigned as the experiment control from B caused by non-completion. Preserve existing tracking where it already applies; a new reporting dashboard and additional click/open instrumentation are outside this change.

## Acceptance checks

Implementation is complete when these behaviors are verified with focused tests and appropriate repository checks:

1. Within a selected audience, completers assigned A receive A; completers assigned B and all non-completers receive B. Admin-recorded completion qualifies. A completer outside the audience receives nothing.
2. Assignment is drawn with equal probability once per member for this experiment, survives repeated updates, and is identical across channels. Non-completion never rewrites assignment.
3. Migration preserves existing sent, unsent, and scheduled updates. Creating a new update cannot select legacy mode. Deployment itself produces no notification.
4. Both modes resolve contribution from the recipient's linked response, never another member's answers. Changing the mode selects the other formula and still permits only one notification campaign per update.
5. Valid formula-authored defaults allow missing answers. Syntax errors, runtime errors, missing required configuration, and empty active contributions prevent sending and identify the problem in admin. Invalid inactive formulas and missing answers for B do not prevent sending.
6. A scheduled update that becomes invalid is held before any channel is released. Repair permits eventual delivery without duplicates or rerandomization; invalid A recipients are never rerouted to B.
7. Eligibility and answers changed before the delivery snapshot affect the result. Changes afterward leave every channel's frozen content unchanged. Retries do not resend a successful delivery.
8. Normal and retrospective messages match the defined templates. Check less than seven days, exactly seven days, and exactly fourteen days after completion; email subjects exclude greetings and later sentences, and SMS ends with the existing destination link.
9. Each independently enabled channel sends, each disabled channel does not, and in-app entries remain available. Existing email/SMS preferences and the update-specific push preference govern this behavior.
10. Audience selection, explicit sending, visibility restrictions, publication behavior, and link destinations retain their current semantics. Ordinary publication does not send, and one update never sends both normal and retrospective campaigns.
11. Recorded exposure distinguishes assignment, actual branch, completion eligibility, mode, and delivery outcomes without requiring a new analytics interface.

This spec covers item 3 only. Suspension rules and the other notification categories remain outside its implementation scope.

## Implementation choices

Agent decisions made while implementing, with rationale.

- **Collective result reuses `shortNotifString`.** Branch B's push ("Update: #{alliance_result}") is exactly what that field already produced, so recognition updates author `#{alliance_result}` there instead of in a new column. The admin labels it "Collective result" in recognition modes.
- **Mode column.** `ActionUpdate.notificationMode` is `legacy | normal | retrospective`. The migration backfills every existing row as `legacy`, and the column keeps `legacy` as its default so a server that predates it can still insert. The API requires `normal` or `retrospective` on create. A legacy update can't switch modes, and no update can switch to legacy.
- **Formula shape.** A contribution formula is the existing options-formula shape (`inputs` + `formula`), restricted to `field` and `list` inputs (`common/src/forms/contribution-formula.ts`). Saving rejects a malformed formula, but drafts may save one that doesn't compile yet. Sending checks compilation and evaluates per member. Server-side checks don't run the TypeScript type checker; the admin editor does that.
- **Answer source.** Each member's answers come from their completion's `taskFormResponse`, read against that response's own form snapshot, so form edits and form variants still read correctly. A completion with no response (admin-recorded) evaluates with no answers, so only a formula default can resolve it. The admin editor lists the questions of the action's current form and its variants, one per field id, so a formula can read whichever form a member answered.
- **Experiment.** Reuses `ExperimentAssignment` with a new `Experiment.ActionUpdateRecognition`; variant is A and control is B. Its 50/50 insert-or-ignore draw moved to `assignExperimentArms`, shared with the missed-suite notice. Arms are drawn for every audience member at check, send or preparation, not only for completers, so a member's arm exists before they complete and never changes afterward.
- **Exposure record.** `ActionUpdateExposure` holds one row per update and recipient, unique on that pair. Sending creates the rows, which fixes the audience. When the update comes due, one transaction fills in mode, assigned arm, completion, branch, contribution, whole weeks, the rendered copy for each channel, and the click `cid`. It also creates the inbox entries. Measurement reads this table. Push outcomes are the `Push` rows of the exposure's inbox entry; mail and SMS are linked directly, and a failed one sets `emailFailedAt` or `textFailedAt` instead.
- **Timing.** Sending validates and then records the audience, both in the request. If the update is already due, preparation runs right after. Otherwise a cron runs every minute and prepares due updates, which also retries held ones, so fixing a held update needs no further action. A failed preparation rolls back, creating no entries, and stores a reason without PII in `notificationHeldReason`, shown in admin. "Check recipients" (`POST /actions/updates/:id/recognition-check`) lists the affected members by name.
- **Delivery.** A separate 30-second cron claims prepared exposures in batches, gated by `notifDeliveryEnabled()` like other workers, and runs one loop at a time under an advisory lock, as the other email and SMS senders do. External channels skip any recipient whose inbox entry they can't see, matching the legacy push dispatcher, and the row records that skip as `hiddenAt`. A claim older than 10 minutes with no `deliveredAt` gets reclaimed, and a run skips any row another run reclaimed from it. Mail and SMS already sent or failed are skipped, and pushes deduplicate through their idempotency key. One recipient's failure doesn't stop the rest of the batch; that row retries once its claim expires. Push uses `pushesForActionUpdates`, as the legacy dispatcher does. Email and SMS use `userActionNotifsEnabled_email` and `userActionNotifsEnabled_text`. Email HTML-escapes the body, because contributions come from member answers.
- **Inbox wording for B.** The web and mobile inboxes already prefix every action-update entry with "Action update:". B's inbox entry is therefore `#{alliance_result}` without "Update: ", which still leads its push and SMS.
- **Punctuation.** Wherever the templates end a sentence with ".", the period is skipped if the authored text already ends in `.`, `!` or `?`, so authors' own punctuation never doubles. An email subject is the template's own first sentence, so a member's contribution is never split. Only the authored collective result is, by `sentence-splitter`, which reads past abbreviations such as "Dr." and "Sen.". Dotted initialisms such as "U.S." and "H.R." never end it, even where one does end a sentence, and a period after a number before a capitalized word always does, so "Check recipients" shows the collective result's subject before sending.
- **Link.** `#{link}` is the absolute action page URL with the exposure's `cid`, the same `withCid` handling action-event emails and texts use.
