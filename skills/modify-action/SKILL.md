---
name: modify-action
description: Read before changing an existing action in the local database — moving its dates, reordering, retheming, editing its fields or form, moving it between projects, archiving or deleting — optionally adding fake engagement.
---

# Modify action

Changes one existing local action as the invoker asks, such as "move 176 to 3 weeks ago and populate it with engagement". Any local action qualifies, staging or fake. Follow the Conventions and Server sections of `(root)/skills/fake-action/SKILL.md`.

## Asking

Ask whenever the request leaves a choice that the code and the action can't settle: which date a move anchors on, what a new theme should be, how long a moved member phase lasts. Batch every open question into one call of the structured question tool (`AskUserQuestion`), your recommendation first with "(Recommended)" in its label. Without that tool, ask in one numbered plain-text message with your recommendation beside each question.

Every run also asks whether to record the change in `.scratch/fakes/`, where `/import-fakes` restores it after a reload. Recommend recording when the action already has a file there (a file whose `action.name` matches), and db-only otherwise.

## 1. Read

Gather the action's current state: its fields, its events and status now, its activity counts by type, its updates, its project and suite, and its form. `bun scripts/list-actions.ts` shows status and participation, and `bun scripts/get-action-form.ts <id>` shows the form.

Done when you can state the change as a before → after list. If anything in it is a guess, ask.

## 2. Change

**Fields and theme.** `PATCH /actions/:id` with only the fields that change: `name`, `body`, `shortDescription`, `category`, `timeEstimate`, `cohortExpression`, and so on. Form wording goes through `PUT /tasks/updateForm/:formId` with `{schema}` and the current snapshot id the form returns. A retheme rewrites the name, body, short description, categories and form text together, so they agree. Answers members already gave stay as written.

**Dates and state.** `bun scripts/shift-action.ts <id> --launch <ISO>` moves the whole history: events, activity, form responses, updates and cohort decisions. The `member_action` date lands on `--launch`, and everything keeps its spacing. It refuses a move that would put existing activity in the future, and it refuses actions in a suite, which move through the suite routes in `server/src/actions/action-suites.controller.ts`. To lengthen, shorten, close or reopen a phase without moving the launch, add an event with `POST /actions/:id/events`, passing `?acknowledgeDeadlineShortening=true` when the deadline moves earlier. No route edits an existing event; to change one event's date, update its `action_event` row with SQL.

**Order.** The member feed shows actions with upcoming events first, then the latest launch, and uses `priority` only to break ties (`findAllSorted` in `server/src/actions/actions.service.ts`). Reorder by moving launch dates, or set ties with `POST /actions/priorities`. A project orders its steps by launch date, so reordering steps means moving dates.

**Projects.** `PUT /projects/actions/:actionId` with `{projectId}`, or `null` to remove the action from its project. `POST /projects` and `PATCH /projects/:id` create a project and set its name and category.

**Archive and delete.** `POST /actions/archive/:id` and `POST /actions/unarchive/:id`. `DELETE /actions/:id` soft-deletes the action: ask before deleting, recommending archive.

Done when re-reading the action shows the after list.

## 3. Engagement

Only when asked. `/fake-engagement` needs the member phase open now, because the server refuses completions after the deadline. When the action isn't live, or a move is also asked for:

1. Note the action's highest `action_activity` id, then run `bun scripts/shift-action.ts <id> --live`. It puts the launch as late as existing activity allows, so the phase is open now, and prints how long it stays open. It also clears cohort exclusions that were made only because the phase had closed. If it refuses, ask how to reshape the timeline.
2. Follow steps 2 and 3 of `(root)/skills/fake-engagement/SKILL.md` on the action. Follow its step 4 as well if the run is recording.
3. Move the action where it belongs: `bun scripts/shift-action.ts <id> --launch <ISO> --spread-after <noted id>`. That re-times only the new activity, at random across the member phase, so it looks as if it happened then while older activity keeps its times. Updates keep their dates, so word them for the moment they're dated. Without a move, go back to the original launch date.

Done when the activity counts show the planned outcomes and the launch sits at the asked date.

## 4. Record

Skip this step when the invoker chose db-only.

- Field and project changes: edit the file's `action` and `project` by hand. A staging file records only `action.name`, so it changes only on a rename.
- Date moves: pass `--record` to the final `shift-action.ts` call. It rewrites the file's dates from the db and sets `recordedAt` to now, so an import lands the action where it now sits.
- Archiving and deleting aren't recorded. Tell the invoker that a reload restores the action.

Done when `bun scripts/import-fakes.ts --check` passes.

## 5. Report

Report:

- the before → after list, with old and new launch dates;
- engagement counts by outcome, if any was added;
- whether the change was recorded;
- the admin URL: `http://localhost:<admin port>/actions/<id>`.
