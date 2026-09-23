---
user: Charles Lien
task: Optional categories for select and multiselect form elements
---

## User request

- Add the option to categorize select and multiselect form elements, like `optgroup`.

## Approval of agent proposals

The user said, “go with your recommendation for all,” approving the following nine agent-authored recommendations. Their origin remains the agent; the detailed spec and rationale are in DECISIONS.md.

1. Support every existing select and multiselect display mode on web and mobile, including fields inside lists and headings above checkbox groups.
2. Use non-selectable headings, one level deep, with each option in at most one category; omit collapsing and category-wide selection.
3. Let admins create, rename, and reorder categories within a field, assign options, and reorder options within categories. Categories are local to the field, without a shared library.
4. Allow categorized and uncategorized options together. Show uncategorized options first, without a heading.
5. Deleting a category keeps its options and makes them uncategorized. Hide empty categories from respondents.
6. Search category names as well as option labels. A category-name match shows all its options; an option-label match shows that option under its heading. Hide headings without matching options.
7. Keep category order fixed when randomizing; shuffle options within each category and within the uncategorized section.
8. Use plain-text category names without Markdown or variables. Require nonblank names unique within the field, ignoring case and surrounding spaces.
9. Make categories presentation only: preserve option values and existing answers; selected-value summaries and reports show option labels only. Existing forms remain uncategorized without a migration.
