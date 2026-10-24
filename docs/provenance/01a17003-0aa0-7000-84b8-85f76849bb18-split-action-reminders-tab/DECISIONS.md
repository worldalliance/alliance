## Target

`ActionRemindersTab.tsx` is the smallest file still under an `alliance/max-lines` waiver, and no other worktree's branch or uncommitted work touches it, so the split can't collide with parallel work (REQUIREMENTS.md).

## Fix

The waiver defers splitting a file over the 500-line limit, so the fix is the split.

- `groupSchedule.ts` holds the pure schedule logic: the labels each card shows for a group's timing, and the send start the tab sorts groups by. Both take the event a group's timing counts from, which the tab still resolves from the suite's events. Being pure, it gets unit tests per timing mode.
- `PresetPicker.tsx` renders the "Load preset..." menu and owns its open state. It disables presets that anchor to a dependency deadline when there is no upcoming one. It renders only while the create form is open, so hiding the form closes the menu; before, the menu reopened with the form.

`ActionRemindersTab.tsx` keeps the queries, the create, edit, delete, and populate handlers, and the layout.

`actionTimelineData.ts`'s `normalizeReminders` also computes when a group sends, but it ignores timing anchors and relative ranges and treats ranges differently, so it stays separate.

## Tests

The preset picker's anchoring had no tests. `ActionRemindersTab.test.tsx` now covers anchoring to the next upcoming dependency deadline and disabling the preset without one, landing before the split so they pass against both versions.
