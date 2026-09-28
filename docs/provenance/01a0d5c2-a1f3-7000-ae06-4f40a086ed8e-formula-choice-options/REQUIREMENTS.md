---
user: Charles Lien
task: Populate select options from previously submitted multiselect answers and unions of those answers
---

# User request

Dropdowns (select elements) should offer anything selected in a multiselect field from a previous form response, including unions of those selections.

The user invoked the spec skill: interview and document the design before implementation.

# Approved agent recommendations

The following proposals originated with the agent. The user approved the first two with “go with your recommendation,” then approved all four remaining questions with “go with your recommendation for all.”

1. Configure options through a formula using the existing formula editor and input system. The agent clarified that the formula can choose latest versus all submissions, combine fields across forms, add fixed choices, and control labels and order; these do not need separate settings.
2. Read the person filling out the form's own submitted responses. Admin previews read the selected member's responses.
3. Support single-choice selects and multiselects, including inside repeating lists, on web and mobile.
4. Merge repeated stored values automatically, retaining the first occurrence's label and position. Unrelated source choices with the same value, such as `option1`, also merge; a formula can rename values to keep them distinct.
5. An empty result displays a disabled field saying “No options available.” Optional fields can be skipped; required fields block submission. A broken formula or failed source load shows an error and blocks the form.
6. Completed responses preserve selected labels when source answers later change. Source history stays fixed while a form is open. Reopening a draft refreshes history and clears selections that are no longer available.
