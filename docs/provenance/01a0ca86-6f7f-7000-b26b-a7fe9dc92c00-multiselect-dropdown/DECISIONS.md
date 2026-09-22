# Multiselect dropdown

These are agent-proposed choices accepted by the user. They remain distinct from user-origin requirements.

## Configuration

Use optional `dropdown` and `searchable` booleans on multiselect fields. Treat omitted flags as false so existing schemas retain their checkbox display without a data migration.

| Admin choice        | dropdown | searchable |
| ------------------- | -------- | ---------- |
| Checkboxes          | false    | false      |
| Dropdown            | true     | false      |
| Searchable dropdown | true     | true       |

Zod rejects `searchable: true` when `dropdown` is false or omitted. The admin selector updates both flags together, omitting both for Checkboxes, so it cannot produce this invalid combination. New fields default to Checkboxes. Switching display modes preserves answers, defaults, options, randomization, limits, and other field settings: this setting changes presentation, not answer identity or storage.

## Selection and presentation

- Use a dropdown on web and in admin previews, and a selection sheet on mobile, following each platform's existing picker conventions.
- Display selected option labels as wrapping chips below the closed control. Each editable chip has an accessible × removal button. Chips expose the full label rather than hiding selected answers behind truncation.
- Retain selected options in the open picker, marked with checkmarks on web and checked checkboxes on mobile. Activating an option toggles its selection immediately; the picker stays open until dismissed so users can choose several answers in one interaction. Dismissal retains the selections.
- Show `Select options…` on the trigger when empty and a count such as `3 selected` when populated. Render no selection area underneath when empty.
- Order chips by the picker's option order, including the existing randomized order when enabled. Selection and search do not introduce a separate chip ordering.
- Preserve existing required validation and selection limits. At the limit, disable only unselected options; selected options and chip removal remain available. Keep the existing limit guidance and validation messages.
- Removing a chip moves focus to the next chip, else the previous one, else the trigger, so keyboard users keep their place.
- Provide individual selection and removal, without Select all or Clear all controls. Disabled and read-only fields cannot change selections; read-only chips have no removal controls.

These choices keep selected answers visible while allowing several choices without repeatedly reopening the picker.

## Search

Use the existing single-select label matcher: trim the query, match substrings while ignoring case and accents, and preserve option order. Reuse the shared matching behavior so the same label is discoverable on web and mobile.

Show a search input only in Searchable dropdown mode. Show `No matches` when filtering finds no options. Retain the query while selecting or deselecting, and reset it when reopening. Filtering affects only picker options; all selected chips remain visible underneath, including selections excluded by the query. Search text never becomes an answer.

## Implementation

- Web uses Base UI `Select` with `multiple` for Dropdown and `Combobox` with `multiple` for Searchable dropdown. A combobox trigger cannot take focus without an input inside the popup, so the plain mode cannot share the combobox.
- Base UI's multiple combobox clears the query after each selection, with reason `input-clear`. The web component controls the query, ignores those clears, and resets the query when the picker opens.
- On web, typing a query highlights the first match so Enter toggles it, and a printable character typed on the closed trigger opens the picker with that character as the query and its first match highlighted. Base UI highlights a query set this way only in its `always` auto-highlight mode, which `Combobox.Root` forwards but leaves out of its type, so the query-dependent setting passes through a commented cast. The single-select searchable dropdown shares this keyboard behavior, which it previously lacked: Enter after typing selected nothing, and characters typed on the trigger were dropped.
- Option labels in the picker and chips render as inline Markdown, as checkbox labels do, because the same options switch between modes. Search and chip removal names use the label's plain text as rendered, on web and mobile, as does typeahead on web, so users find and hear the text they see.
- Answers keep the order in which options were selected, as checkbox mode does; only chips follow option order.
- Restoring a draft, on web and mobile, drops multiselect selections of options the field no longer has, including inside list cards. An answer left with none stays an empty selection, which is how a cleared field is stored, so restoring it does not bring back the field's default. Filtering on restore, rather than in each renderer, keeps display, the selection limit, and validation working from the same values in every display mode.
- The mobile sheet does not scroll to a selection on opening, unlike the single-select sheet, because several selections have no single target.

## Verification for implementation

- Schema checks accept all three modes, omitted flags, and explicit false flags; reject search enabled with dropdown false or omitted.
- Admin checks cover saving and reloading each mode, switching out of searchable mode, and retaining the field's answers and settings.
- Web, mobile, and admin preview checks cover multiple selection without closing, deselection inside the picker and through chips, reopening, count updates, wrapping labels, defaults and restored answers, and randomized ordering.
- Search checks cover partial labels, case, accents, surrounding whitespace, no matches, query retention during selection, reset on reopening, and chips for filtered-out selections.
- Validation checks cover empty required fields, reaching the selection limit, freeing a slot by removing a selection, and disabled/read-only controls. Verify keyboard operation and accessible labels on web, and accessible selection and removal controls on mobile.
- Existing checkbox fields continue to render and submit their existing array of option values. This feature changes neither response storage nor single-select answers.
