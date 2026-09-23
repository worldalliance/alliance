## Clear controls are hidden when the field is disabled

Web scale showed "Clear selection" on a disabled field; the shared condition (`!disabled && onChange`) now hides it there too, since clearing a disabled field is an edit the field forbids.

## Required fields clear like optional ones

Per the follow-up request, no control checks `required`. A cleared required field is caught by the existing required-field validation on submit.

## Dropdown `X` sits just right of the trigger, not inside it

This departs from the approved "in the trigger, next to the chevron". The searchable trigger is a `<button>` and the native control is a `<select>`, neither of which can contain a button, and overlaying one would collide with the native `<select>` arrow, whose position shifts with padding. The `X` is a flex sibling after the trigger, which shrinks while it shows. Mobile does the same so the `X` stays its own accessibility element instead of merging into the trigger.

## Mobile radio and scale clear on a second tap

Matches the existing mobile scale behavior, per the approved proposal. The gesture has no visible hint; web shows a link instead because a native radio fires no event when its checked option is clicked.

## Custom `X` over base-ui `Combobox.Clear`

`Combobox.Clear` renders with `tabIndex={-1}` and focuses the combobox input, which the closed popup does not mount. A plain button calling `onChange("")` is reachable by keyboard and serves both the native and searchable selects.

## Radio and scale keep a text link on web

A lone `X` beside a list of radios reads as ambiguous; the text link matches the existing scale control. Both now share `ClearSelectionButton`.

## Out of scope

Multiselect and checkbox already uncheck. Timezone and city were not changed.
