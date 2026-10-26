# Actions timeline spotlight search

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Client-side only

The page already loads every action through `useActionsAdmin`, so the search runs over that list with no server change and no migration.

## Dependency

`match-sorter` is new. Per the repo's dependency rule it is declared in `apps/frontend/package.json` and installed from there, even though only `apps/admin` uses it.

## ID matching

A query equal to an action's ID, ignoring surrounding whitespace, lists that action first, above name matches. IDs match exactly, not fuzzily or by prefix, so `18` doesn't list 183. The query still runs as an ordinary text search too. The ID match respects a scoped category.

## Categories

`category` is an `ActionCategory[]`, so an action with several categories counts toward, and is listed under, each one. Labels are the capitalized enum values; the listing order is a fixed array in the admin app, not the enum's declaration order.

## Timeline scrolling

`ActionTimeline` owns the scroll containers, so it takes a `focusAction` prop: each new `{ id }` object scrolls once to that row (top of the chart) and to the start of its first phase, less a 40px margin, then flashes the row. `Actions.tsx` turns the action's status bucket on and sets `focusAction` in the same update, so the row exists when the timeline scrolls. An action with no events has no bar, so only the vertical scroll applies.

The flash highlights the name-column row only (`data-flashed`, amber, fading over 700ms), not the chart lane.

`ActionTimeline.tsx` was at 490 lines, so the week header and reminder overlay moved into `ActionTimelineWeekHeader.tsx` and `ActionTimelineReminderOverlay.tsx` first, unchanged. `codex` was not installed to suggest splits; these two were the largest self-contained JSX blocks.

## Popup

- Built on base-ui `Dialog` directly rather than the shared `Modal`, because `Modal` always focuses its panel and the input must take focus on open.
- The panel's top sits at 30% of the viewport height, horizontally centered, so the input stays put as the result list grows and shrinks.
- Keys are left alone when focus is in an input, textarea, select, contenteditable, dialog, menu, or listbox. Menus and listboxes are included because their typeahead uses printable keys.
- Space is not an opening key, since it activates a focused button or link.
- Keys typed while the popup is open but before focus reaches its input are appended to the query, so fast typing loses no characters.
- Arrow keys stop at the ends of the list rather than wrapping.
- Picking a category returns focus to the input, so Backspace can remove the chip.
