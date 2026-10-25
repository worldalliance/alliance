# Assigned row list

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Why the server fills the form in

The request started as a client-side "shared seed" for the `random` variable input. That can't meet the day-1 requirement:

- Installed builds that predate `random` (PR #731) fail the variable as an unknown input kind. Any failing variable blocks the whole form ("This form can't be displayed"): `shared/useFormRenderer.ts` `variablesError`, rendered by both `FormRenderer`s.
- Builds from 2026-08-11 to 2026-09-23 resolve inputs through a lookup table with no fallback, so an unknown kind probably throws during render.
- A `seed` key added to `random` would be ignored by builds that already have `random`. They would pick separately per variable and show a mismatched jurisdiction and email with no error.
- The client doesn't validate a fetched schema (`useTaskForm` returns the JSON as typed). Anything an old build meets that it doesn't know either blocks the form or gets misread.

So nothing in the served schema may be new to old builds. The server resolves the row and serves the result as plain text, links, default values and present-or-absent blocks, which every build since variables already renders. Placeholders use `#{row.<field>}` because the server replaces them before serving: no client ever sees one. The `.` keeps them outside the variable-name pattern, so they can never collide with a `#{name}` variable.

## Serving

- `GET /tasks/slug/:id` has no guard and no user today. It reads the caller's session when one is present, without requiring it (`authService.getAuthenticatedUserId`), so it can assign and fill in the row. The served schema leaves out the list, the key fields and every row condition. With 200+ rows, members never download the list.
- Guests can't be keyed at load time: the server creates a guest session only in `submitPublicForm`, and the mobile app sends the guest token only on submit (`apps/mobile/components/ActionTaskPanelForm.tsx`), never when loading the form. That's why the user chose members only.
- The admin app loads forms through this same member route: the builder, conflict resolution, action duplication, responses, reporting and question pickers. A new admin-guarded route returns the stored schema unfilled, and those admin paths move onto it, so a member-filled schema never reaches an admin save or clone.
- Verified: every mobile build since forms existed sends the signed-in member's bearer token on this fetch. Mobile has set `Authorization` on the shared API client with `client.setConfig` since `d0d985f3a` (2025-05-16): first in `AuthContext` and `_layout`, now in `apps/mobile/lib/session.ts` `setAuthHeader`. Every form fetch since forms reached mobile goes through the generated `tasksGetForm`, which uses that client (`ActionTaskPanelForm` in 2026-01, then `useFormSchema`/`useTaskForm`), and the route has been `/tasks/slug/{id}` throughout.
- A fetch without a session, for a form that has a list, fails with 403 "Sign in to open this form". A guest submission to such a form fails with 403 "Sign in to submit this form". Assignment failure fails the fetch too, so the app shows its existing load error.
- The member route reads the session with `getAuthenticatedUserId`, which treats a bad or stale token as no session rather than rejecting it. Forms without a list therefore load exactly as before for every caller.
- Internal `getForm` callers are untouched. Filling happens only in `getMemberForm`, which only the member route uses, and in the submit paths.
- The admin builder and admin responses views read the stored, unfilled schema through admin-guarded routes, never the member-filled one.
- Cached form queries are keyed by form id, and the filled form differs per member. Checked: logout (web `AuthContext`, mobile `clearSession`) and login (`startSession`) both clear the query cache (`shared/lib/useMe.ts`), and no query persister exists. So an account switch on one device can't serve the previous member's filled form.
- The admin app's form loads now use `adminTaskFormQuery` / `useAdminTaskForm` (key `["form", "admin", id]`, under the `["form"]` prefix that invalidation already targets) or call `tasksGetFormAdmin`: `useSavedForm`, `useFormSave`, `useActionCommands`, `useFormResponsesAdmin`, `useActionMergedResponsesAdmin`, `useActionReporting`, and the question pickers in `shared/lib/useFormSchema.ts` (admin-only).
- A member's fetch of a source form, for a previous-answer block or a variable, also goes through the member route. If that source form has a list, the fetch assigns the member a row of it. That's accepted: the member is reading that form.

## Storage

- The list, its key fields and the row conditions live in the form schema. That way they are versioned by form snapshots like every other schema change, and the submit check can read them from the snapshot the response names.
- Assignments go in a new table: form id, user id, row key, and assigned-at, unique per form and member. It follows `action_form_assignment`, including recovering from a concurrent insert of the same member (23505). Balancing reads counts per row key for the form, excluding unsubmitted assignments older than 7 days. Two members assigned at the same moment may land on the same row; the next assignment rebalances. That slight imbalance is accepted rather than locking the form.
- A row key is the tuple of the admin's key-field values, stored as JSON so composite keys compare exactly.
- `form_response` gains a nullable jsonb column holding `{ key, values }`, set on submit from the member's stored assignment, never from the client.

## Submitting

- The submit paths (`submitForm`, `submitFollowUpForm`, `optoutForm`) resolve the member's row against the form's current list, the same row the member was served. They then fill and filter whichever snapshot the submission names. Validation, contract extraction and the saved response all use that member-filtered snapshot, so a dropped required field isn't required.
- The saved `assignedRow` holds the row's values from the current list at submit time.
- Mobile builds from before the form-snapshot cutover (around 2026-04-27) submit `schemaSnapshot`, the schema they were served, instead of `formSnapshotId`. `resolveSubmissionSnapshot` matches it by hash, so for a form with a list it also accepts the hash of the member-filled schema (`snapshotForRow` of the current snapshot with the member's row) and returns the unfilled snapshot for the caller to fill. `saveFormDraft` passes the member's row the same way.
- Prefilled values become ordinary answers once submitted. The server doesn't compare them to the row.

## Output views

- `FormResponseOutputDto` serves `schemaSnapshot` to old builds too. The server fills placeholders and applies row conditions in that snapshot from the response's saved copy before serving it. Old builds therefore never see `#{row.…}`, and output stays as submitted even after list edits.
- The same goes for every DTO that sends a response's snapshot: `FormResponseDto` (completed view, linked drafts, submit results, and admin responses, so admin replays read as the member saw them) and `FormResponseHistoryDto`. All go through `memberSnapshotSchema`, which leaves a schema without a list as it is. The history DTO is only read for field definitions, so it strips the list with no row to fill from.

## Admin

- The builder has a "Rows" tab. It takes the rows as pasted JSON, the key fields as checkboxes, and a row condition per item, whose values are picked from the list's own values. Conditions are edited here rather than in each element's sidebar, so the existing per-element editors don't change. Conditions cover top-level page items and output-view display blocks. Nested accordion blocks can't carry one: the schema omits it, the way it omits their visibility rules.
- Validation (`rowListErrors`, part of `validateFormSchema`, so it runs on the server and in the builder): the list must be non-empty, every row must have a value for every key field, key tuples must be unique, and at least one key field must be picked. Placeholders and conditions naming a field no row has, or used on a form with no list, fail the save. List-level errors take the admin to the Rows tab (`IssueTargetKind.Rows`).
- Placeholders are filled in the text paths variables already use, plus a big link's `url` and a field's `defaultValue`. `html` blocks stay excluded. One walker in `variable-interpolation.ts`, parameterized by paths and rewrite, serves both.
- The preview picks a row and renders `schemaForRow` for it: the same transform members get.
- Responses table and CSV columns are named `row.<field>`, one per field across the responses' saved rows.

## Left alone

- The client-side `random` input from PR #731 keeps working as shipped, and forms using it still block on builds that predate it.
