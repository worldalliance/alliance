# Project action workflow

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Phases are derived, not stored

`actionPhase` in `apps/admin/src/lib/actionPhase.ts` works the phase out from `staffPreview` and `memberActionPhase(events)` in `common/src/actionEvent.ts`, so no column or migration is needed. Because the phase isn't stored, it can't disagree with the events. Staff preview already ends at launch (`isStaffPreviewActive` in `server/src/actions/staff-preview.ts`). A fifth value, `Closed`, covers the time after the deadline. `ActionPhasePill` shows the project page's existing count label for it (wrapping up, done).

## Previous step

`previousProjectStep` in `server/src/actions/project-steps.ts` takes the last non-archived, non-onboarding action in project order. That order is the one `ProjectsService.findOneWithSteps` already uses, now shared as `byProjectStepOrder`. Unscheduled actions sort after scheduled ones, by id. So when a project has drafts, the newest draft's cohort is the one copied. With no previous step the cohort is `{ type: "Staff" }`.

## Transactions without splitting `actions.service.ts`

`actions.service.ts` is over 5,000 lines. Per the user's call, it only gains the hooks the new workflow needs, and the new logic lives in `server/src/actions/project-actions.service.ts`:

- `ActionsService.create` is split into `insertAction(em, dto)`, which joins the caller's transaction through `writeUnderLive`, and `afterActionInserted`, which shifts priorities and syncs general-update dates after commit.
- `ReminderGroupService.createReminderGroup` takes an optional `em`, used for the event read, the deadline lookup and the save. Those reads have to see events created earlier in the same transaction.

Quick-create runs in one transaction: suite, `insertForm` (blank task form), its snapshot history, `insertAction`, then the project link. The form snapshot itself is content-addressed, so it is found or created before the transaction.

Scheduling also runs in one transaction. It saves both events as suite-managed, checks prerequisites, and creates the reminder groups. It doesn't go through `ActionsService.addSuiteEvent`, because that commits each event in its own transaction behind the deadline-shortening guard. Scheduling refuses an action that already has a Members-taking-action event, so there's no deadline to shorten. `reloadUsersJoinedForAction` and `syncGeneralUpdateDatesForSuites` run after commit, the same as in `addEventToActions`.

Unscheduling soft-deletes the two events with `softDeleteCascade`, which also cascades to their reminder groups.

Changing dates reuses the suite page's endpoint (`actionSuitesBatchUpdateSuiteEventsAdmin` through `useActionSuiteAdmin`). It keeps the deadline-shortening confirmation.

## The client sends titles and reminder bodies

The schedule request carries the two events as `CreateActionEventDto` and the reminders as `CreateReminderGroupDto[]`. Event titles come from `DEFAULT_EVENT_NAMES`, moved out of `CreateEventForm` into `apps/admin/src/lib/actionStatusDisplay.ts`. Reminder bodies come from `reminderPresets` and `defaultReminderPresetNames` in `apps/admin/src/components/reminders/presets.ts`, which the suite page's "Populate default reminders" now uses too. So the presets stay where they are, and the panel sends exactly what the suite page sends. The server sets each reminder's `suiteId` to the action's suite.

## Shared suites

The panel and the server both refuse a suite that holds any other action, archived or not. Suite-event batch updates touch every action in the suite, so an archived sibling's events would move too.

## Suite rename

`renameSoleActionSuite` in `server/src/actions/sole-action-suite.ts` runs in the same `writeUnderLive` call as `ActionsService.update`. It renames the suite only when the suite holds no other action.

## Staff-testing gate

The four required items are listed in `STAFF_TESTING_REQUIREMENTS` (`apps/admin/src/lib/staffTestingGate.ts`). The readiness checklist builds those rows from that list, so the rules aren't written twice. The gate applies in admin only. The server still accepts `staffPreview` on any update, as the dashboard's Staff Preview checkbox did before.

## Unsaved changes

`useActionEditor` exposes `dirty`, which compares a JSON snapshot of the draft against the last seeded or saved draft. `setStaffPreview` and `setTaskFormId` patch that snapshot. That way a later Save from the details form can't write Staff Preview back to its old value. `FormBuilder` gains an optional `onUnsavedChangesChange`.

## The new page

`/projects/:projectId/action/:actionId` is `apps/admin/src/pages/ProjectActionPage.tsx`, with its pieces in `pages/project-action/`. It reuses `useActionAdmin`, `useActionEditor`, `ActionEditor`, `ActionReadinessChecklist` and `FormBuilder`. The editor lookups moved into `useActionEditorLookups` so the dashboard and the new page share them.

The details form hides its Staff Preview checkbox there, since the phase header controls it.

The task form section stays collapsed until opened, and it can't be collapsed while it has unsaved edits. When mounted below the fold, `FormBuilder` scrolls the page down to its initial selection (`CanvasWorkspace`).

Links that go to the new page when the action has a project:

- the project page's step names;
- "Open in project" in the `/actions/:id` toolbar.

The actions timeline's links are left as they are for now. At implementation time the timeline files held uncommitted work in progress.

Quick-create navigates to the new page before the project and action lists finish refetching. On the local staging copy, waiting for that refetch took over 30 seconds.

## Pacific time

Release defaults and the pickers use `@date-fns/tz` (`apps/admin/src/lib/releaseDates.ts`). They work in America/Los_Angeles whatever the browser's timezone is, and the pickers are labelled "(Pacific)". The defaults are computed when the panel opens. Moving the launch doesn't move the deadline.
