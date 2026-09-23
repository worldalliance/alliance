# Select and multiselect option categories

Status: implemented. The product choices below were proposed by the agent and accepted together by the user, as recorded in REQUIREMENTS.md. Implementation guidance and verification cases are agent-authored elaborations of those choices.

## Scope and presentation

Support categories in regular and searchable selects, and checkbox, dropdown, and searchable multiselects. Apply them in the admin builder and preview, web forms, and mobile forms, including select and multiselect fields nested inside lists. Existing form-editing permissions govern category editing.

Categories are optional, field-local, single-level headings. An option belongs to zero or one category. Headings cannot be selected or collapsed and offer no bulk selection. These constraints keep the feature equivalent to visual option grouping rather than introducing new answer types or controls.

Uncategorized options form the first section, without a heading. Named categories follow in the admin-defined order, with their options in admin-defined order. Empty categories remain editable in the builder but are absent from respondent views. A field with no categories retains its flat presentation.

Use native `optgroup` for the ordinary web select. Custom web pickers, mobile sheets, and checkbox lists expose equivalent labelled groups with non-interactive headings. Keyboard navigation skips headings; assistive technology can identify the group associated with an option. Existing selection, dismissal, focus, disabled/read-only, required-field, and maximum-selection behavior continues to apply to individual options across the whole field.

Radio, ranking, and specialized pickers are outside this feature. Categories have plain-text names; Markdown and variable expressions are not interpreted.

## Authoring

Admins can create, rename, reorder, and delete categories, assign or reassign an option to a category, clear its assignment, and reorder options within a section. Category names must be nonblank after trimming and unique within the field after trimming and case folding. This keeps assignments unambiguous while permitting the same category names in different fields.

Deleting a category removes its heading and assignments while retaining all its options, values, and defaults. Clearing an individual assignment moves that option to the uncategorized section. Empty categories can be saved so authors can organize a field before adding its options.

Display-mode changes preserve categories and assignments. Duplicating or saving and reloading a field preserves its category structure, including inside lists. Renaming, moving, or deleting a category never changes option identity, selected answers, defaults, or conditions that reference option values.

## Search and randomization

Extend the existing option-label search with category-name matching, using the existing matcher’s whitespace, case, accent, and substring behavior. An option is visible if its own label or its category name matches. A category-name match includes all of that category’s options; otherwise only matching options appear under its heading. Each option appears once. Empty results show the existing no-matches state without orphaned headings.

Filtering preserves section and option order. Clearing search restores the full grouped list. Search does not alter selections; selected chips and summaries remain visible even when their options are filtered out. Existing query retention and reset behavior remains in effect.

When randomization is enabled, keep uncategorized options first and named categories in authored order. Shuffle only within each section using the existing seeded-randomization behavior, retaining stability across rerenders and consistency across platforms. When randomization is disabled, use authored order. Fields with no categories retain their existing randomization behavior.

## Answers and compatibility

Categories are form-schema metadata. Single-select answers remain option-value strings and multiselect answers remain arrays of option-value strings. Option values stay unique across the entire field, including across categories. Category labels and IDs are never submitted as answers.

Selected-value labels and chips, response tables, reports, exports, and conditional logic continue to use individual options, without category prefixes or category-level aggregation. Preserve the existing selected-chip ordering rule using the grouped picker order, while keeping stored answer ordering independent of display ordering.

Existing schemas omit category metadata and require no data migration. Adding categories to an existing form preserves saved answers, defaults, and restored drafts. Existing snapshots remain uncategorized; new snapshots retain the grouping metadata with the schema.

## Implementation guidance

These are agent-selected implementation choices, not separately stated user requirements.

- Add an optional ordered category list containing stable IDs and names to select and multiselect schemas, plus an optional category reference on their options. Keep the flat option list so answer consumers continue to use option values. Stable category IDs let names change without rewriting assignments.
- Interpret category-list order as heading order and flat-list relative order within each section as option order. Assignment changes retain that relative order; deleting a category merges its options into the uncategorized section using the same rule. Explicit within-section reordering updates the option list.
- Validate unique, nonblank category IDs, names meeting the authoring rules, and references to categories in the same field. Reject malformed grouping metadata through the existing schema-validation path; surface authoring errors and block saving invalid schemas. The builder clears references atomically when deleting a category.
- Restrict grouping metadata to select and multiselect schemas, even where option schemas are shared with other field kinds. Keep category IDs local to the field when duplicating fields.
- Centralize grouping, filtering, and within-section randomization where both web and mobile can consume them, so all display modes use the same ordering and matching rules.

## Implementation

- The schema stores `categories: [{ id, name }]` on select and multiselect fields and an optional `category` id on their options. Radio and ranking options reject both. Names compare after trimming and lowercasing; accents are not folded, so `Café` and `Cafe` are distinct names. One function reports name errors for both the schema and the builder, so their messages match.
- Option and category schemas live in `common/src/forms/options-schema.ts`, outside the already oversized `form-schema.ts`.
- `shared/forms/optionSections.ts` groups, shuffles, and filters options for web, mobile, and the admin preview. An option naming a category the field lacks, possible only in an unsaved draft, renders as uncategorized rather than disappearing. The uncategorized section shuffles with the field's existing seed, and each category with that seed plus its id. An uncategorized field therefore shuffles exactly as before, and renaming or reordering categories does not reshuffle options.
- On web, the plain single-select renders categories as native `<optgroup>`s. The other dropdowns render the sections as Base UI groups with `Combobox.GroupLabel` or `Select.GroupLabel` headings, which keyboard navigation skips. The searchable ones receive the shared filter's result through `filteredItems` instead of filtering themselves, so the matching rule lives in one place. RenderField builds the sections once and passes them to the dropdowns, which do not regroup. Checkbox lists wrap each category in a `role="group"` labelled by its heading.
- On mobile, headings are `Text` with the `header` accessibility role, placed in the same flat list as the rows. React Native has no cross-platform group role, and wrapping sections in views would break the single-select sheet's scroll-to-selection offsets.
- The builder creates categories named `Category N`, counting up from one more than the number of existing categories until a name passes the name rules, with `crypto.randomUUID()` ids. Deleting the last category omits `categories`, returning the field to its legacy shape. Invalid names are flagged inline; saving fails through the server's schema validation, as with duplicate option values. The builder labels a blank-named category `(unnamed)` everywhere it appears, and lists an option naming a missing category as uncategorized through the same `optionSectionId` rule respondent views use. That option's Category select shows a disabled `(missing category)` entry, so choosing No category clears the reference that would otherwise block saving.
- Field and page duplication already deep-copy fields, and category ids are field-local, so duplication needed no change. Response views, exports, conditions, and draft restoration read options by value and needed no change.
- On mobile, the dropdown device fixture has a screen of categorized fields, and `categories.yaml` covers headings, category search in both the single- and multi-select sheets, and scrolling to a selection below a heading. Typing in a searchable sheet scrolls results to the top, so a matching category's heading stays in view.

## Acceptance checks for implementation

No test covers builder duplication, save/reload through the server, or fields inside lists (check 2), or response views, exports, and snapshots (check 7). Those rest on the reasoning under Implementation that duplication deep-copies fields and those consumers read options by value.

1. Schema tests accept legacy fields, mixed grouped/ungrouped options, and empty categories; reject blank or duplicate category names, duplicate category IDs, dangling references, and duplicate option values across categories.
2. Builder checks cover category creation, renaming, reordering, deletion, assignment changes, within-section option reordering, invalid-name errors, save/reload, duplication, display-mode changes, and fields inside lists.
3. Web, mobile, and admin previews show headings and option order correctly in every supported mode, hide empty categories, keep uncategorized options first, and expose accessible group labels with non-selectable headings.
4. Search checks cover option-only matches, category-only matches, both matching without duplicates, case/accent/whitespace handling, no matches, clearing the query, and retained selections excluded by search.
5. Randomization checks prove that options stay in their sections, section order remains fixed, seeded order is stable, disabling randomization restores authored order, and legacy flat fields preserve existing behavior.
6. Selection checks cover defaults, draft restoration, required validation, the field-wide maximum, deselection at the maximum, keyboard interaction, and disabled/read-only fields. Category edits preserve submitted values and conditions.
7. Response views, exports, selected summaries, and chips contain option labels without category prefixes; old snapshots remain usable and new snapshots preserve grouping.
