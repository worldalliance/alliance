# Decisions

- The form stays nullable: an action with no task form is `NULL`, so the property is `taskFormId: number | null` and the API publishes it as a required nullable number. No migration; the column is already a nullable integer with no foreign key, and `migration:generate` shows no diff on `action`.
- Validation follows `forumParticipationPostId`, the other id column: an integer from 1 to the int4 maximum, or `null` to clear it. Before, the property had only `@IsOptional`, so a blank, fractional, boolean or out-of-range value failed in the database with a 500.
- Create and update take the form as optional, alongside `timeEstimate`, so a create that leaves it out stores `NULL` and a patch that leaves it out keeps it.
- The API already sent `null` for an action without a form, despite the `?: number` type. Code that tested for `undefined` misread it, and each case is fixed where the narrowed type surfaced it:
  - Clearing the form, or creating an action with `taskFormId: null`, ran the variant-form check with `formId: null`. TypeORM drops a `null` condition, so the check matched any variant and refused with a 400. It now runs only for a form id.
  - Exporting with `taskForm=true` looked the form up by `id: null`, matching an arbitrary form, which the export then carried. The lookup now runs only when the action has a form.
  - The shared form queries (`useTaskForm`, `useAdminTaskForm`, admin `formResponsesAdminQuery`) skipped only an `undefined` id, so pages for an action without a form requested `/tasks/.../null`. They skip `null` too, and accept it in their types, which is how the queries are already keyed.
  - A disabled or completed web or mobile task panel rendered the form panel for an action without a form, because `null !== undefined`. It now checks for `null`.
- Admin's `FormBuilder` keeps `formId?: number`; the action dashboard passes `taskFormId ?? undefined`. Its other callers and hooks use `undefined` for "no form yet".
