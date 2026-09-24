## Clear controls are hidden when the field is disabled

Web scale showed "Clear selection" on a disabled field; the shared condition (`!disabled && onChange`) now hides it there too, since clearing a disabled field is an edit the field forbids.

## Required fields clear like optional ones

Per the follow-up request, no control checks `required`. A cleared required field is caught by the existing required-field validation on submit.

## Dropdown `X` sits inside the trigger, next to the chevron

The searchable trigger is a `<button>` and the native control is a `<select>`, neither of which can contain a button, so on web both dropdowns lay one shared `DropdownIcons` overlay, the `X` and a `ChevronDown`, over the trigger's right edge. The native `<select>` drops its platform arrow, whose position shifts with padding, so the `X` has a fixed spot beside the chevron. The trigger reserves the overlay's space, so its text width never changes when a value is picked or cleared. Mobile places the `X` as a sibling after the trigger so it stays its own accessibility element.

## Clearing returns focus to the field

The clear control unmounts once the answer is empty, which would drop keyboard focus to the page body. Clearing focuses the dropdown trigger, or the first radio or scale option.

## Mobile radio and scale clear on a second tap

Matches the existing mobile scale behavior, per the approved proposal. The gesture has no visible hint; web shows a link instead because a native radio fires no event when its checked option is clicked.

## Custom `X` over base-ui `Combobox.Clear`

`Combobox.Clear` renders with `tabIndex={-1}` and focuses the combobox input, which the closed popup does not mount. A plain button calling `onChange("")` is reachable by keyboard and serves both the native and searchable selects.

## Radio and scale keep a text link on web

A lone `X` beside a list of radios reads as ambiguous; the text link matches the existing scale control. Both now share `ClearSelectionButton`, and radio reserves the link's space as the scale does, so fields below don't move when an option is picked or cleared. Neither reserves it on a disabled field, where the link never shows.

## Out of scope

Multiselect and checkbox already uncheck. Timezone and city were not changed.
