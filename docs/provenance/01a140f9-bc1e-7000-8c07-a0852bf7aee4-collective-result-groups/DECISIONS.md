# Collective result groups and update preview

Status: implemented. [REQUIREMENTS.md](./REQUIREMENTS.md) defines the behavior, with origins distinguished. The choices below are agent-authored.

## Data

- `ActionUpdate` gets three columns: `splitCollectiveResult boolean NOT NULL DEFAULT false`, `nonCompleterResult text NULL`, and `uninvolvedResult text NULL` (migration `ActionUpdateSplitCollectiveResult`). `shortNotifString` stays as the completed group's text. The default lets a server that predates the columns keep inserting, the same reasoning as `notificationMode`'s default.
- `@IsNotEmpty()` on `shortNotifString` applies only while `splitCollectiveResult` is false. The admin inputs drop `required` in the same case. With split off, the rule stays "Write the collective result."
- Existing rows need no data migration: they default to split off and keep sending as before.
- The create DTO takes the three fields as optional. The update DTO takes them as partial, like its other fields. They appear on `AdminActionUpdateDto` only, never on member-facing DTOs.

## Shared copy code (`common/src/action-update-copy.ts`)

- These moved out of `server/src/actions/action-update-recognition.ts`: `recognitionBody`, `recognitionCopy`, `firstSentence`, `collectiveEmailSubject`, `weeksAgoLead`, `RecognitionBranch`, and `recognitionCopySchema`. The server and its tests import them from common directly; nothing re-exports them. `recognitionBody` takes the mode as common's `ContributionFormulaMode` union, which the server's enum values satisfy.
- `recognitionBody` takes `weeksAgoText` (the lead's text) rather than a number of weeks, so the preview can pass a placeholder. The server passes `weeksAgoLead(weeksAgo)`.
- New here: `RecognitionGroup` and `readGroupResults`, the one implementation of "which text each group reads, and what blocks a send". The server's `readRecognitionConfig`, the preview, and the create dialog's submit check all call it. With split off, every group reads the trimmed `shortNotifString`. With split on, each empty text becomes `null` (skip), and all three `null` fails with "Write at least one group's result."
- `firstSentence`'s tests moved to `common/src/action-update-copy.test.ts`. `sentence-splitter` was added to `common/package.json` and `apps/frontend/package.json` at `^5.0.1`, matching the server's version.

## Planning

- `recognitionGroupOf({ completed, participant })`: completed → `Completed`; on the participant roster → `DidNotComplete`; otherwise `Uninvolved`. The roster is the existing `findParticipantIdsForActions` rule (assigned − away − withdrawn + completed), so withdrawn members land in `Uninvolved`.
- The roster moved out of `ActionsService` into `ActionParticipantsService` (`findParticipantAction`, `findParticipantIdsForAction[ById]`, `findParticipantIdsForActions`) with no change to the code. The recognition service needs the roster, and `ActionsService` already depends on the recognition service, so the move avoids a circular dependency.
- `prepare` reads the roster before opening its transaction, because the roster takes its own pool connections. `check` reads it too, so a contribution that doesn't resolve in a skipped group never blocks a send.
- `planRecognition` leaves out every recipient whose group text is `null`. `recordAudience` already created those recipients' exposure rows at send, so at freeze `prepare` soft-deletes them in one `id = ANY(...)` statement. The delivery query skips deleted rows, so no channel reaches them, and the deleted row records that they were in the audience but skipped.
- The `ActionCohort` audience is the roster itself, so `Uninvolved` is always empty for it. Only the `AllMembers` and `Tag` audiences reach that group.

## Preview (admin)

- `apps/admin/src/lib/updatePreview.ts` builds the variations as pure data from the unsaved texts and the mode. `components/UpdatePreview.tsx` renders them, and both screens use it. The preview runs the shared copy functions on every render, so copy updates on each keystroke with no debounce. If `readGroupResults` fails, its message replaces the cards.
- The placeholders are the sentinel strings `[contribution]`, `[N weeks ago]`, `[name]`, and `[link]`, passed into the shared functions and highlighted with `<mark>` by splitting the output on them. `[name]` has no space, so `nameParts` keeps it whole.
- With split off, the variations are personal recognition plus one "Everyone else" card. With split on, there are four. A skipped group's card says "Not notified: this group's result is empty."
- The split checkbox and the two extra inputs live in `components/CollectiveResultSplitFields.tsx`, under the existing Collective result input on both screens. The editor page hides them, and the preview, once copy is frozen or in legacy mode.

## Counts

- `POST /actions/updates/:id/recognition-preview-counts` (admin), with body `{ notifyType, tagId }`, returns `RecognitionPreviewCountsDto`: `completedPersonal`, `completedCollective`, `completedUndrawn`, `didNotComplete`, and `uninvolved`.
- `ActionsService.findActionUpdateAudience` now resolves both the send and the preview. Its `decideCohort` flag is false for the preview, so the preview skips `decideOpenAction` and reads only saved cohort decisions.
- `ActionUpdateRecognitionPreviewService` holds the counting (in its own file, because the recognition service was already past 500 lines). It reads arms with the new `readExperimentArms`, which `assignExperimentArms` now ends with, so a preview never draws an arm. The pure tally is `countRecognitionPreview`.
- The editor page refetches through react-query whenever the unsaved audience type or tag changes. These are select inputs, so there's no debounce. A `None` audience shows zeros without a request. "Tag" with no tag picked shows "Pick a tag to count recipients." A failed request shows "Couldn't count the recipients." Undrawn completers get one line above the cards.

## Verification

- Unit: `server/src/actions/action-update-recognition.spec.ts` (group selection, skip, all-empty, counts tally), `common/src/action-update-copy.test.ts`, `apps/admin/src/lib/updatePreview.test.ts`, `components/UpdatePreview.test.tsx`, and new cases in `ActionUpdatePage.test.tsx` and `ActionUpdatesTab.test.tsx`.
- E2e (`server/test/action-update-recognition.e2e-spec.ts`): a split send that skips an empty group and soft-deletes its exposure; counts for an unsaved audience that draw no arm.
- Browser: the editor page against local data, where the counts matched the endpoint and the split fields re-rendered the preview live.
