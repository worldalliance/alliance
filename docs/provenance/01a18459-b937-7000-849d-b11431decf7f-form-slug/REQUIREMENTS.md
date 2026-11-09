---
user: Alex Dorey
task: Give forms a slug, and show it as `<action slug>::<form slug>` in place of "Form #<id>" in admin
---

## User-origin requirements

- Every form has a slug. Admin stops showing forms as "Form #<id>".
- Example: on the admin Form Variants tab of local action 176 (`/actions/176?tab=form-variants`, action slug `grantmaking-prep-2`), form 163 (the action's task form) has slug `v1` and form 164 (its "Expert confidence" variant) has slug `v2`. They display as `grantmaking-prep-2::v1` and `grantmaking-prep-2::v2`.
- A form that belongs to an action displays as `<action slug>::<form slug>`.
- Follow-up forms are numbered on their own, with an `f` prefix: `f1`, `f2`, …
- A form that belongs to no action gets the base36 encoding of its id as its slug, with no prefix or padding (form 123 → `3f`). Staff can change it.

## Agent-proposed, user-approved

- Staff edit a form's slug inline in admin.
- When a form becomes some action's task form or follow-up form, or moves to another action, it keeps its slug if staff have renamed it. A collision with a slug already in use in the new action fails loudly. A form whose slug is still its no-action base36 default instead takes the next `v`/`f` number in the action.
- The `::` prefix is the action's slug, not its name.
- Slugs are unique per action. The server enforces this, not a database index.
- One namespace per action: the task form, its variants and branches, and its follow-up forms all have distinct slugs.
- Orphan forms (no action) form one namespace of their own. A renamed orphan slug must be unique among live orphan forms.
- A new form in an action gets the next number in its sequence:
  - the task form, variants and branches share the `v` sequence (`v1`, `v2`, …)
  - follow-up forms use the `f` sequence (`f1`, `f2`, …)
- The next number is one higher than the highest number in that sequence among the action's live forms. Reuse is not prevented: a deleted form in the middle leaves a gap, and deleting the highest one frees its number.
- A migration backfills existing forms:
  - each action's task form and variants/branches get `v1`, `v2`, … by form id order (163 → `v1`, 164 → `v2`)
  - its follow-up forms get `f1`, `f2`, … by form id order
  - orphan forms get base36 of their id
- Edited slugs must match the existing slug pattern: lowercase letters and digits joined by hyphens, at most 80 characters.
- `<action slug>::<form slug>` replaces "Form #<id>" everywhere admin shows it:
  - the variant coverage table
  - the branch editor
  - variable input pickers
  - form-field condition rules
  - cohort expression descriptions
  - user detail form responses
- An orphan form displays its bare slug.
- The form builder page (`/forms/:id`) shows the slug in its header and lets staff edit it inline there.
- Admin only. The member web and mobile apps don't show slugs.
- Anyone who can edit a form can edit its slug, under the same guard as the form builder's existing save.
