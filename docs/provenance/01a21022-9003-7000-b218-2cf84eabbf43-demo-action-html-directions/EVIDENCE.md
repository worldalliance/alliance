# Evidence

## Trial run of HTML-page mode

On 2026-11-24, on `main` at `8501a49f6` plus this change, with the local db holding staging data (775 users), the agent ran the mode for `html page: a single environment-related action that has a narrow cohort and launches tomorrow at 7pm`. A fresh subagent run was blocked by the session's permission mode, so the implementing agent ran it itself, reading the skill as written.

- Default path traced in code: `CreateActionMenu.tsx` (**+** → **New Action**) → `ActionDashboard.tsx` (`/actions/new`, heading **Create New Action**, `ActionForm.tsx` with **Content**, **Settings**, **Participating users**, **Create Action**) → after creation, the tabs **Task Form** (`FormBuilder` with **Edit form JSON**, **Save Form**) and **Event Management** (`CreateEventForm.tsx`: **New Status**, **Launch now**, **Launch time (<browser zone>)**, **Automatically create deadline event**, **Add Event**).
- The new-action form defaults **Visibility Mode** to **Public** (`useActionEditor.ts`), so the page tells the person to change it to **All Members**, matching the API mode.
- `POST /actions/evaluate-cohort` with `{"type":"CompletedAction","actionId":168}` returned 40 users; `user_action` had no rows.
- The form schema passed `formSchema` (`.scratch/demo/validate-form.ts`).
- The page rendered in the browser pane with 8 steps, 13 copy buttons and no external resources. A real click on a copy button wrote to the clipboard; a script-triggered click, which carries no user gesture, showed **Copy failed**.

## Startup and launch constraints

Source inspection on 2026-11-24 at `8501a49f6` (execution paths traced, no server or database started):

- `server/src/app.module.ts` imports `ForumModule`, which registers `LegacyDeletedFlagService`. Its `onApplicationBootstrap` in `server/src/forum/legacy-deleted-flag.service.ts` creates a SQL function and triggers and backfills legacy-deleted posts and comments. `AppModule.onModuleInit` also creates or updates the configured local admin. Starting the normal API therefore performs writes independently of the cohort request.
- `apps/admin/src/components/CreateEventForm.tsx` passes no minimum date to `DateTimePicker` and submits the chosen date through `addEvent`. `ActionSuitesService.addEventToActions` saves it without a future-only constraint. The existing `server/test/actions.e2e-spec.ts` case “future events should not affect current status” posts a past launch; it was inspected, not run. By contrast, `assertReleaseDates` in `server/src/actions/project-actions.service.ts` requires a changed launch to be in the future. A past launch is therefore not a blanket limitation of the admin.
