## Fix

The waiver defers splitting a file over the 500-line limit, so the fix is the split.

## Reset before the split

When `initialValues` changes, as when an admin picks a preset, the form reloads its fields from them, except the push message and "Use suite task count", which kept their old values. So picking "Announcement" after opening the form left the default push message in place. The reload now covers them too. The fix lands before the split because the split loads the initial state and the reload from one function, which would otherwise change this behavior without its own test.

## Draft

The form's fields live in one `ReminderGroupDraft` state. `reminderGroupDraft.ts` derives it from `initialValues` with `draftFromInitialValues`, which both the first render and the reload use, so no field can be left out of the reload again. The selected event stays separate, because changing it also calls `onEventChange`. `ActionReminderGroupFormInitialValues` asks only for the `id` of each user and of the user tag, the only fields the form reads, so tests can build initial values without whole entities.

## Request

`reminderGroupRequest.ts` maps a draft to request fields, sending each timing field only for its timing mode and each recipient field only for its cohort. The recipient-count preview and the save request both use that mapping, so they can't drift apart. The preview also skips an invalid relative window through the same `relativeRangeIsValid` check the save uses. `reminderGroupSubmitPayload` holds the submit validation as a pure function returning a `Result`, with the same checks, order, and messages as before. On success it returns the absolute send time and the range normalized to ISO strings. Being pure, it gets a unit test for each refusal.

## Components

Each piece of the form that owns its own rendering moves into a component, with any state only it reads:

- `ReminderKeywordHelp.tsx`: the keyword table, its expanded state, and the `keywords` list the editors highlight, which tracks the table.
- `ReminderMessageFields.tsx`: the email subject, email, text, and push editors, their previews, and the preview task counts.
- `ReminderScheduleFields.tsx`: the inputs for each timing mode and the "Relative to" anchor selector.
- `TentativePlanSummary.tsx`: the recipient count, its first send time, and the count's loading and retryable error states. The form keeps fetching the count, because its submit waits on it.

The components take the draft fields they show and an `onChange` patch, so the draft keeps a single owner. The name, timing-mode select, and recipient fields stay in the form, beside the draft and the requests that read them.
