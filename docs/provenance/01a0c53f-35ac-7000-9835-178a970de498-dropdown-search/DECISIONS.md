Use an optional searchable flag on select fields, defaulting to the existing dropdown.

Match a trimmed, case-insensitive substring of the displayed label and preserve option order. Fold accents with es-toolkit's deburr so users can find accented labels without typing the accents. This makes partial-label searches predictable without fuzzy ranking. Share the matcher between web and mobile.

Share normalization with time-zone search through optionSearch.ts. Keep its word-start matching rule separate: it prevents "China" from matching "Indochina", while generic dropdowns accept substrings anywhere in arbitrary labels.

Use the installed Base UI combobox for web keyboard navigation and focus handling, and add search to the existing mobile option picker. Search text never becomes an answer.

Scroll the mobile searchable picker to its selected row once per opening, using the row's measured position to account for wrapped labels. Clearing a query can remount that row, so later layout callbacks must preserve the user's browsing position. Reset the offset when the list becomes empty because Android retains the old offset even with no rows. Leave search unfocused so opening the picker preserves space for browsing options.

Reset the mobile query when opening. Preserve the query and list while closing because iOS keeps the modal contents visible during its dismissal animation.

Cap the mobile list at half the window space remaining above the keyboard. A cap based on the full window lets the list extend behind the iOS keyboard; scrolling to the end then moves the outer sheet and clips the search input. Use keyboard-controller's window measurements, as FormModal's KeyboardAvoidingView does.

Keep the window and keyboard subscriptions inside the searchable scroll list. The modal mounts that list while presenting and dismissing, so closed and plain pickers do not subscribe, and keyboard height changes do not rebuild the option rows.

Set no explicit height on either dropdown variant. Both then take the height the shared input padding and line height produce, which is what the surrounding text inputs use; a fixed 2.5rem made the two variants match each other but left both shorter than every other control on the form.

Truncate the web trigger's selected label to one line to keep long labels from increasing the control height. Show the full label in the open list.

Keep the empty-state live region displayed when it has no text so screen readers can announce later changes. Remove its padding while empty to avoid blank space.

Omit label addons when the label is hidden so interactive addons cannot remain invisibly focusable. Keep the hidden question text for the accessible name.

Name the web dropdown from the rendered field label so Markdown syntax is excluded. Keep visually hidden labels available to screen readers and use "Options" when no label is supplied.

Land the required-validation and invalid-field focus change as its own commit before this one, so the behaviour every existing form inherits is separable from the search option. Let the form validate both required dropdown variants, with aria-required on the searchable trigger and native select, so both display the inline error and use the form's invalid-field navigation. Mark the form noValidate so application validation runs first and reports errors in field order. Browser validation running first let an empty native required field, or Base UI's hidden required input, block submission before an earlier dropdown's error showed. Once application validation passes, run the browser's constraint check before submitting or advancing a page, because application validation does not duplicate every browser check, including email syntax. After failed validation, scroll to the first invalid field and focus its invalid control after the destination page renders. Count an error inside a list card at the list's position, so a later field's error does not take focus from an earlier list. Queue a new focus request on every attempt so submitting again returns to the error. Prefer controls marked invalid over nearby label buttons, and let native focus scrolling reveal a control inside a long field group.

Keep the synthetic native picker fixture and Android Maestro regression flow in the dropdown-search feature commit so the standalone change carries its device regression check. Import the production picker and stylesheet so the flow exercises actual component state and native layout. Resolve Metro's port from the checkout configuration and avoid accounts, API calls, and device identifiers in the fixture.

Give the fixture no tsconfig of its own. The mobile package's typecheck config already covers it, and a nearer config is what an editor picks, without the repo's strict settings or the uniwind className types.

Use Android text selectors for the regression flow. The iOS modal currently groups its input and rows into one accessibility element, so the fixture supports manual iOS inspection without claiming an automated iOS pass.
