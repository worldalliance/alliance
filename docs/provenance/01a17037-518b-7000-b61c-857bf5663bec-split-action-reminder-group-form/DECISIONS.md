## Fix

The waiver defers splitting a file over the 500-line limit, so the fix is the split.

## Reset before the split

When `initialValues` changes, as when an admin picks a preset, the form reloads its fields from them, except the push message and "Use suite task count", which kept their old values. So picking "Announcement" after opening the form left the default push message in place. The reload now covers them too. The fix lands before the split because the split loads the initial state and the reload from one function, which would otherwise change this behavior without its own test.

## Draft

The form's fields live in one `ReminderGroupDraft` state. `reminderGroupDraft.ts` derives it from `initialValues` with `draftFromInitialValues`, which both the first render and the reload use, so no field can be left out of the reload again. The selected event stays separate, because changing it also calls `onEventChange`. `ActionReminderGroupFormInitialValues` asks only for the `id` of each user and of the user tag, the only fields the form reads, so tests can build initial values without whole entities.

## Request

`reminderGroupRequest.ts` maps a draft to request fields, sending each timing field only for its timing mode and each recipient field only for its cohort. The recipient-count preview and the save request both use that mapping, so they can't drift apart. The preview also skips an invalid relative window through the same `relativeRangeIsValid` check the save uses. `reminderGroupSubmitPayload` holds the submit validation as a pure function returning a `Result`, with the same checks, order, and messages as before. On success it returns the absolute send time and the range normalized to ISO strings. Being pure, it gets a unit test for each refusal.
