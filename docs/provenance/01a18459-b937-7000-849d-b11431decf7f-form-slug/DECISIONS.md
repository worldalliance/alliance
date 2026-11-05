# Form slug

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Storage

`form.slug varchar(80) not null`, with no unique index. A form has no `actionId`. It reaches an action through `action."taskFormId"`, `action_form_variant."formId"` or `follow_up_form."formId"`, so per-action uniqueness can't be a single-table index. Every form gets a slug at creation or in the backfill, so the column is non-null.

`SlugColumn` doesn't fit: it adds a global unique index and generates the slug from `name`. The column reuses `SLUG_MAX_LENGTH` and `SLUG_PATTERN` from `src/utils/slug.ts`. The rename body validates through a new `SlugField()` in `src/datasources/slug-column.ts`, the required sibling of `OptionalSlugField`.

## Owning action

`server/src/actions/form-slug.ts` holds the one SQL list of a form's owners: task form, variant/branch, follow-up, each of a live action. A form in more than one takes the first in that order. Slug numbering, the uniqueness checks and `displaySlug` all read that list.

`ActionsService.findActionsByFormIds` stays unchanged and still ignores follow-ups. It also drives `usedInAction`, withdrawals-for-form, share links and the contract-signing check, and folding follow-ups into it would change those.

## Where slugs get assigned

- `insertForm` creates every form:
  - `TasksService.createForm` with no action: base36 of the id. If a renamed orphan already holds that, it gets `slugCandidates` suffixes (`3f-2`).
  - A variant or branch cloned from the task form: next `v`.
  - An imported action's task form copy: next `v`, never the exported slug.
- `slugFormForAction` runs inside the write that links an existing form: action create/update with a new `taskFormId` (`v`), follow-up create, or a follow-up update that changes `formId` (`f`). A form whose slug still matches `^<base36 id>(-\d+)?$` is renumbered. Any other slug must be free in the action, or the write fails with `409 The slug "<slug>" is already taken`.
- A form detached from its action, say by deleting its follow-up, keeps its slug. Orphans can therefore hold duplicates like `f1`. Only a rename is checked against the orphan namespace.

## Concurrency

Numbering and the action-scoped checks run under `lockActionRow` (moved out of `ActionFormVariantService` into `lock-action-row.ts`, now shared). Concurrent creates on one action therefore can't both take the same `vN`. Orphan renames take no lock. They're manual and rare.

## Numbering

`next = max(N over the action's live forms whose slug matches ^v(\d+)$) + 1`, and the same for `^f(\d+)$`. A slug renamed to something else, like `control`, drops out of the sequence.

## Display

The forms index (`GET /tasks/listForms`, `FormSummaryDto`) carries `slug` and `displaySlug`, which the server composes as `<action slug>::<form slug>`, or the bare slug for an orphan. Every admin site reads the cached index through `useFormDisplaySlugs` / `formLabel` in `shared/lib/useFormsAdmin.ts`. The pickers read it through `FormOption.displaySlug`. `formLabel` shows `Form #<id>` only while the index loads, or for a form it doesn't list, such as a deleted one. `FormDto` and the member-facing endpoints don't carry the slug.

Sites: the variant coverage table, the branch editor's Form row (inline editor), the form builder header (inline editor), the source-form pickers in variables and field rules (`title (displaySlug)` in place of `title (#id)`), cohort descriptions of `FormFieldValue` leaves, and user detail submissions. The pickers' fallback options for an unlisted form still read `Form #<id>`, because no slug is known for them.

## Inline edit

`PATCH /tasks/forms/:formId/slug` (`AdminGuard`, the same guard as `updateForm`) returns no body. The client invalidates the forms index. `FormSlugEditor` shows the action prefix and edits the form's own part through `SlugField`, formerly the action dashboard's `ActionSlugField`, moved to `components/` now that it has a second caller. A refusal stays inline under the draft.

## Backfill migration

`1793222558455-FormSlug` adds the column as nullable, then assigns:

- `v1…` over each action's live task form and live variant/branch forms, ordered by form id
- `f1…` over each action's live follow-up forms, ordered by form id
- base36 of the id over every other form, soft-deleted ones included

It then sets the column `NOT NULL`. Soft-deleted forms get base36 so they leave no gaps in the live sequence. The generated file also carried unrelated drift from the local database, which was dropped. A re-run of `migration:generate` shows no `form` changes.
