# Collective result groups, update preview, and copy as written

Status: implemented. [REQUIREMENTS.md](./REQUIREMENTS.md) defines the behavior, with origins distinguished. The choices below are agent-authored.

## Data

- `ActionUpdate` gets three columns: `splitCollectiveResult boolean NOT NULL DEFAULT false`, `nonCompleterResult text NULL`, and `uninvolvedResult text NULL` (migration `ActionUpdateSplitCollectiveResult`). `shortNotifString` stays as the completed group's text. The default lets a server that predates the columns keep inserting, the same reasoning as `notificationMode`'s default.
- `@IsNotEmpty()` on `shortNotifString` applies only while `splitCollectiveResult` is false. The admin inputs drop `required` in the same case. With split off, the rule stays "Write the collective result."
- Existing rows need no data migration: they default to split off and keep sending as before.
- The create DTO takes the three fields as optional. The update DTO takes them as partial, like its other fields. They appear on `AdminActionUpdateDto` only, never on member-facing DTOs.
- The create and update DTOs no longer take `notificationMode` or any formula. `createActionUpdate` sets `notificationMode` to `normal` itself, because the column's default stays `legacy` for servers that predate it.

## Shared copy code (`common/src/action-update-copy.ts`)

- `recognitionCopy({ allianceResult, recipientName, link })` builds every recipient's copy: the text as written in-app, "Update: " before it in push and text, its first sentence as the email subject, and a "Hi <first name>" email body. `RecognitionBranch`, `recognitionBody`, `weeksAgoLead`, and `common/src/forms/contribution-formula.ts` are gone, along with `parseContributionFormula` in `shared/parsed-dtos.ts`.
- `RecognitionGroup` and `readGroupResults` are the one implementation of "which text each group reads, and what blocks a send". The server's `readRecognitionConfig`, the preview, and the create dialog's submit check all call it. With split off, every group reads the trimmed `shortNotifString`. With split on, each empty text becomes `null` (skip), and all three `null` fails with "Write at least one group's result."
- `firstSentence`'s tests live in `common/src/action-update-copy.test.ts`. `sentence-splitter` was added to `common/package.json` and `apps/frontend/package.json` at `^5.0.1`, matching the server's version.

## Planning

- `usesRecognition(mode)` is a `Record<ActionUpdateNotificationMode, boolean>`, false only for legacy. `readRecognitionConfig` returns the group results, or a single message for what blocks a send.
- `recognitionGroupOf({ completed, participant })`: completed → `Completed`; on the participant roster → `DidNotComplete`; otherwise `Uninvolved`. The roster is the existing `findParticipantIdsForActions` rule (assigned − away − withdrawn + completed), so withdrawn members land in `Uninvolved`.
- The roster moved out of `ActionsService` into `ActionParticipantsService` (`findParticipantAction`, `findParticipantIdsForAction[ById]`, `findParticipantIdsForActions`) with no change to the code. The recognition service needs the roster, and `ActionsService` already depends on the recognition service, so the move avoids a circular dependency.
- `prepare` reads the roster before opening its transaction, because the roster takes its own pool connections. Completion comes from the latest terminal activity alone; no form responses or snapshots are loaded.
- `planRecognition` can no longer fail per member. It leaves out every recipient whose group text is `null`. `recordAudience` already created those recipients' exposure rows at send, so at freeze `prepare` soft-deletes them in one `id = ANY(...)` statement. The delivery query skips deleted rows, so no channel reaches them, and the deleted row records that they were in the audience but skipped.
- `prepare` still holds an update whose texts turned invalid after sending, with `readGroupResults`' message as `notificationHeldReason`.
- Sending checks `readRecognitionConfig` directly. The admin "Check recipients" button, `POST /actions/updates/:id/recognition-check`, `RecognitionCheckDto`, and `RecognitionMemberIssueDto` are removed: their job was resolving each member's contribution, and the preview already shows the config problems and the email subject live.
- The `ActionCohort` audience is the roster itself, so `Uninvolved` is always empty for it. Only the `AllMembers` and `Tag` audiences reach that group.

## Preview (admin)

- `apps/admin/src/lib/updatePreview.ts` builds the variations as pure data from the unsaved texts. `components/UpdatePreview.tsx` renders them, and both screens use it. The preview runs the shared copy function on every render, so copy updates on each keystroke with no debounce. If `readGroupResults` fails, its message replaces the cards.
- The placeholders are the sentinel strings `[name]` and `[link]`, highlighted with `<mark>` by splitting the output on them. `[name]` has no space, so `nameParts` keeps it whole.
- `PreviewVariation` is `Completed`, `DidNotComplete`, `Uninvolved`, and `Everyone`. With split off there is one "Everyone" card, counted as all three groups together, because every member gets the same copy. With split on, there are three. A skipped group's card says "Not notified: this group's result is empty."
- The split checkbox and the two extra inputs live in `components/CollectiveResultSplitFields.tsx`, under the existing Collective result input on both screens. Once copy is frozen, the editor page replaces them with a note that edits no longer reach anyone, and hides the preview. Legacy updates get neither.
- `components/ActionUpdateRecognition.tsx` keeps only `COLLECTIVE_RESULT_DESCRIPTION` and `NotificationHeldBanner`. The editor no longer loads the action's form or its variants, which only fed the formula editor.

## Counts

- `POST /actions/updates/:id/recognition-preview-counts` (admin), with body `{ notifyType, tagId }`, returns `RecognitionPreviewCountsDto`: `completed`, `didNotComplete`, and `uninvolved`. The server-side tally, `RecognitionPreviewCounts`, is a `Record<RecognitionGroup, number>`.
- `ActionsService.findActionUpdateAudience` resolves both the send and the preview. Its `decideCohort` flag is false for the preview, so the preview skips `decideOpenAction` and reads only saved cohort decisions.
- `ActionUpdateRecognitionPreviewService` holds the counting (in its own file, because the recognition service was already past 500 lines). The pure tally is `countRecognitionPreview`.
- The editor page refetches through react-query whenever the unsaved audience type or tag changes. These are select inputs, so there's no debounce. A `None` audience shows zeros without a request. "Tag" with no tag picked shows "Pick a tag to count recipients." A failed request shows "Couldn't count the recipients."

## Migrations

- `RemoveActionUpdateRecognitionExperiment` starts from `migration:generate`, with two hand edits. The generator emitted `DROP TYPE "ExperimentArm"` (and a matching `CREATE TYPE` in `down`), but that type is shared with `experiment_assignment.arm`, so both lines were removed. A `DELETE FROM "experiment_assignment" WHERE "experiment" = 'action_update_recognition'` was added before the enum swap, because the cast would fail on those rows. `down` restores the enum value and a nullable `assignedArm` column, but not the deleted rows.
- The admin's pre-send check used to draw arms, so assignment rows can exist even though no update went out; the local db had 196. The migration deletes them regardless.
- `RemoveRecognitionTemplating` starts from `migration:generate`, with two hand edits. The generator emitted `DROP TYPE "ActionUpdateNotificationMode"` after dropping the exposure's `mode` column, but `action_update.notificationMode` still uses that type, so the line was removed, along with its `CREATE TYPE` in `down`. An `UPDATE` moving `retrospective` rows to `normal` was added before the enum swap. `down` restores the columns empty and the `retrospective` value, but not which updates used it.
- `readExperimentArms` lost its last outside caller and is no longer exported. `ExperimentArm` stays because other experiments use it.

## Verification

- Unit: `server/src/actions/action-update-recognition.spec.ts` (group selection, skip, all-empty, counts tally, copy), `common/src/action-update-copy.test.ts`, `apps/admin/src/lib/updatePreview.test.ts`, `lib/actionUpdateDetails.test.ts`, `components/UpdatePreview.test.tsx`, and cases in `ActionUpdatePage.test.tsx` and `ActionUpdatesTab.test.tsx`.
- E2e (`server/test/action-update-recognition.e2e-spec.ts`): every member gets the result as written on each channel; a split send that skips an empty group and soft-deletes its exposure; counts for an unsaved audience; new updates are created in `normal` mode; a send blocked with no collective result; a scheduled send held when its texts turn invalid, then delivered once repaired.
- Browser: the editor page against local data, where the counts matched the endpoint and the split fields re-rendered the preview live.
