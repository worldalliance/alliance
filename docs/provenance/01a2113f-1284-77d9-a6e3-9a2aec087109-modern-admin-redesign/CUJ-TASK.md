# Today's journey: creating a task and taking it to launch

Derived from code on `modern-admin` at c722280863. PR #1028 ("Guard launches and unsaved edits in the admin action flow") merged to `main` after this commit (merge 5c44acdf5c, not an ancestor of c722280863), so none of its changes are in this checkout; where its description or its `DECISIONS.md` says behaviour changes, it is marked **#1028:**. "Action" in code is "task" here. Admin paths are under `apps/admin/src/`, server paths under `server/src/`.

Everything below was read in the code unless marked *(plausible, not traced)*.

## How visibility works (server)

- Status is the status of the latest event dated at or before now; with none it is Draft (`actions/entities/action.entity.ts:73-79`).
- `userCanSeeAction` (`actions/action-visibility.service.ts:48-92`), in order: admins see everything; archived → hidden; staff see it while `staffPreview` is on and member action hasn't started (`actions/staff-preview.ts:6-21`); Draft → hidden; visibility mode **Public → visible to everyone, signed in or not, without checking the cohort**; All members → every signed-in member; Participating groups → saved cohort decision or live cohort.
- **Any non-Draft status counts**, not only Members taking action: a Planned, Office action, Completed, Failed or Abandoned event also takes a task out of Draft (`ActionStatus`, `actions/entities/action-event.entity.ts:27-36`).
- **Public-only tasks open for anyone, even as a draft or archived**: `userCanOpenAction` returns `publicOnly || userCanSeeAction(...)` (`action-visibility.service.ts:44-46`), and the member page `GET actions/slug/:id` goes through it (`actions/actions.service.ts:328-340`, `member-actions.service.ts:294-327`). They are left out of feeds (`action-visibility.service.ts:94-108`), but the page opens to anyone who has the numeric id.
- Updates, timeline items and global feed items appear only for tasks the member can see (`action-updates.service.ts:339-357`, `global-feed.service.ts:195-215, 350-400`).
- Cohort decisions: before member action starts, readers use the live cohort. Once it starts, the cohort-decision worker (every 5 minutes, `cohort-decision.worker.ts:15`) writes saved decisions, and readers use those until the deadline (onboarding never closes) (`cohort-decision.ts:39-101`). Public-only tasks never get saved decisions (`cohort-decision.ts:87`).

## 1. Entry points that create a task

| Entry | Where | What it pre-fills | Server call |
|---|---|---|---|
| New Action | `/actions` Create menu (`components/CreateActionMenu.tsx:56`) → `/actions/new` | `emptyActionDraft` (`pages/action-dashboard/useActionEditor.ts:24-45`): blank name, description and body; **`visibilityMode: "public"`**; no cohort; `staffPreview`, `publicOnly`, `optional`, `onboarding` false; no task form | `POST actions/create` on "Create Action" (`useActionEditor.ts:345-353`) |
| Add new action (suite) | Empty suite page only (`pages/ActionSuitePage.tsx:85-100`) → `/actions/new?suiteId=N` | Same, plus `suiteId` (`useActionEditor.ts:151-166`). Once a suite has tasks, the page offers no "add task"; the task's Suite field is the only way | same |
| New action (project) | `/projects/:id` "New action" modal: name and short description (`components/NewProjectActionDialog.tsx`) | Server-side (`actions/project-actions.service.ts:76-139`): **creates a new suite named after the task**, an empty task form "<name> form", `visibilityMode: Public`, cohort copied from the previous project step or `{type: "Staff"}`, the project's categories, and assigns the project | `POST project-actions…` |
| Duplicate Action | Task Overview toolbar (`pages/action-dashboard/useActionCommands.ts:58-111`) | Clones the task form as "<title> (Copy)", then creates "<name> (Copy)" from **the editor's current `form` state, unsaved edits included**: suite, visibility mode, stored cohort, prerequisites, `staffPreview`, `publicOnly`, optional, onboarding, images (`useActionEditor.ts:210-245` seeds `form` from the whole action). It copies no events, variants, follow-ups, updates or reminders | `POST actions/create` |
| Paste JSON | `/actions` Create menu (`CreateActionMenu.tsx:17-40`): reads the clipboard, no confirm | Server `importAction` (`actions/action-import-export.service.ts:76-206`): every exported column (visibility, cohort, `publicOnly`, `staffPreview`, `archived`, priority…), reviewers, the task form, **the suite matched by name, or a new one with that name**, and **every event in the JSON, with its original dates** | `POST actions/pasteJson` |
| Make a project from this action | `/projects` standalone card (`components/ProjectCardTile.tsx:13-54`) | Not a new task: makes a project and assigns the existing one | — |

Export (`useActionExport.ts:13-15`) has Events off, Task form on and Suite off by default, so a paste usually carries no events. **If Events was ticked, the pasted task is created already in the status of its past events, so it is live to its audience the moment it is pasted, with no confirmation** (`action-import-export.service.ts:186-195`). If Suite was ticked and a suite with that name exists, the paste joins it.

## 2. What exists the moment a task is created

- A task row with **no events, so it is Draft** (`actions.service.ts:107-191`; `action.events = []` at :135). Members can't see it, unless it is `publicOnly` (see above).
- Priority: `shiftPrioritiesAfterInsertion` puts it above the "new items" divider (`actions.service.ts:186-191`). This only affects order on the home page.
- If it has a suite: `syncGeneralUpdateDatesForSuites` runs. A suite's general updates take their dates from the suite's *first* task's member action phase (`general-updates.service.ts:225-265`). For a new draft this usually changes nothing.
- **A suite's existing events are not copied** to a task that joins it. Copying happens only when a suite event is added (`action-suites.service.ts:214-233`). A task added to an already-launched suite stays Draft, with none of the suite's dates.
- Task form: none from `/actions/new` (the Task Form tab creates "<name> form" on first save, `ActionDashboard.tsx:288-295`, `useActionEditor.ts:168-182`); an empty one for project-created tasks; a copy for Duplicate and Paste.
- No event emitter, entity subscriber or listener reacts to creating or saving a task (the only entity subscriber is `datasources/slug.subscriber.ts`; the only listener in `actions/` handles Kora reviews). **Nothing is sent to anyone.**

## 3. Building it: each step and what its save does

The dashboard `/actions/:id` has tabs (`pages/ActionDashboard.tsx:26-145`): Overview, Details, Event Management (**#1028:** renamed "Events"), Updates, Task Form, Form Variants, Follow-up Forms, Responses, Cohort Decisions. `/projects/:p/action/:id` is a shorter editor with a phase header, checklist, details, task form and release panel (`pages/ProjectActionPage.tsx`).

**Details** (`components/ActionForm.tsx`, saved by `handleSubmit`, `useActionEditor.ts:300-394`): one `PATCH actions/:id` (`actions.service.ts:347-470`) with name, descriptions, body, images, authors, reviewers, category, suite, visibility mode, task kind, time estimate, `staffPreview` (only a field here, saved with everything else), audience (onboarding, `publicOnly`), completion (complete after deadline, prevent completion, optional), forum, custom stat, prerequisites, cohort.
- Client guards: the "Save anyway?" content confirm for site links and "worldalliance" (`components/useContentConfirm.tsx:191`); save disabled when the stored cohort can't be parsed (`useActionEditor.ts:303-310`). There is no leave guard (**#1028:** adds one, and requires a non-blank name).
- Server checks: cohort parsed and its references validated; **optional → mandatory refused once cohort decisions exist** (`actions.service.ts:375-384`); a task form already used as a variant refused; prerequisites valid; partition grid followed; `assertNoPartitionLaunch`. Renaming a task renames its own sole suite (`renameSoleActionSuite`, :433-438).
- Effect on members: none while Draft. **On a live task every field applies at once**: body and description on the next load, visibility mode and cohort to who can see it, `publicOnly` to who can open it, prevent completion and complete after deadline to who can submit.
- **Suite field**: moves the task between suites; general update dates are re-synced for both suites (`actions.service.ts:461-465`). Moving into a launched suite doesn't give the task the suite's dates.
- **Project**: assigned straight away from the toolbar picker (`components/ActionProjectControls.tsx:35-144`). It doesn't affect visibility.
- **Priority**: lives on `/priority`, a separate page (`pages/PriorityPage.tsx`); it affects only home-page order.

**Staff preview / staff testing.** Dashboard: the Staff Preview switch saves with Details, with no gate (`lib/actionFieldDefs.ts:191`). Project page: "Start staff testing" saves `staffPreview: true` straight away. It is gated in the UI on short description, body, task form and cohort (`lib/staffTestingGate.ts`; `components/ProjectStepRows.tsx:75-88`; `pages/project-action/PhaseHeader.tsx`). Server effect: **staff accounts see the task while it is Draft** (`staff-preview.ts`), and form submissions, activity, likes and comments are refused while preview is active (`tasks/form-submission.service.ts:124, 372`, `action-activity.service.ts:114`). It sends nothing. Preview switches itself off when member action starts.

**Task form** (Task Form tab, full builder): `PUT tasks/updateForm/:id` makes a new snapshot that is **live on members' next load; forms have no publish step** (inventory `forms.md` §2.10, B102 and its notes). The first save of a new form links it to the task (`useActionEditor.ts:168-182`).

**Variants (A/B)** (`components/ActionFormVariantsTab.tsx`):
- Staged rows exist only in the browser and are lost on refresh. "Publish drafts" sends one `createVariant` per row, in order, stopping at the first refusal (:123-150).
- Server (`actions/action-form-variant.service.ts:118-170`): clones the task form; splits must total 100% or less. Split and name edits are saved straight away (:172-210).
- Members get variants through sticky assignment: a member is assigned a variant at random by split the first time a form is assigned (`new-assignment.ts:37-58`). **A split change affects only members not yet assigned.**
- Delete: `window.confirm` (:179-190). The server deletes freely, assignments included, before member action starts with no responses; after that it refuses if anyone is assigned (`action-form-variant.service.ts:212-264`).
- A variant's form is edited in the standalone builder (`/forms/:id`), and each save there is live straight away.

**Follow-up forms** (`components/ActionFollowUpFormsTab.tsx`): "Create" makes a form and links it. Fields: name, instructions, target cohort, start date, end date. Delete uses `window.confirm` (:170). Server: the member page gets only the follow-ups whose cohort the member is in (`member-actions.service.ts:450-469`); **start and end dates are not checked on the server**, only in the member client (`apps/frontend/src/components/FollowUpFormPanel.tsx`, `HomePage.tsx`). Follow-ups send no notifications. They can only appear on a task the member can open.

**Updates** (Updates tab → `/actions/:id/updates/:uid`):
- Create (`action-updates.service.ts:55-120`) makes an empty, unpublished update (`visibleAt` null) and sends nothing.
- **The first content save that has blocks publishes it**: `visibleAt = max(now, date)` (`action-updates.service.ts:232-237`). There is no confirm. On a live task, members see it at once (or on its date).
- "Unpublish until displayed date" and "Publish now" are explicit buttons (:271-317).
- "Send notification" (`pages/ActionUpdatePage.tsx:128-140`) uses `window.confirm`. Server (`action-update-notify.service.ts:55-150`) refuses with no audience, an empty body, an already-sent update, an archived task, or **a task still Draft when the entries arrive** (`action-update-visibility.ts:34-57`). Sending is once only (claimed on `notifiedAt`).
- Audiences: task cohort, **all members**, or a tag. Recognition-mode copy is prepared by a worker after the claim.
- **#1028:** Send asks for the typed phrase `I am going to notify many real members`.

**Reminders.** There is no reminders UI on the task. Reminders live on the suite page and work only on the suite's **first** task's member action events (`components/reminders/ActionRemindersTab.tsx:46-67`, TODO).
- Server: a group can only be attached to a member action event (`notifs/reminder-group.service.ts:239`), so **no reminder can exist before a member action event does**.
- Create a group: typed confirm with the live count, outside development mode (`ActionRemindersTab.tsx:212-232`). "Populate default reminders": typed confirm, `many` (:166-186).
- **Editing a group has no confirm** (:255-278), even when it moves the send time.
- Sending (`notifs/action-event-notif.worker.ts:96-103`, every 3 minutes; groups chosen by timing in `action-event-reminder.service.ts:237-311`) **does not check that the task has launched, isn't archived, or isn't in staff preview**: none of `archived`, `Draft` or `staffPreview` appears in the worker, the delivery service or the recipient service. *(Plausible, not traced end to end:* an Absolute or Range reminder timed before its member action event's date would go to the live cohort before launch.) The suite launch panel blocks reminders that would send before members start (`components/suite-launch/launchReminders.ts`). The suite page's reminder form does not; its plan summary only says "(immediately)".
- With a suite, recipients are chosen from the cohorts of **all** the suite's tasks (`notifs/action-event-recipient.service.ts:153-270`). The send-time task list drops Draft tasks (`member-actions.service.ts:414-440`). *(Not traced: whether an empty list suppresses the send.)*

**Prerequisites**: part of Details. The server validates them on every save and on every event write (`prerequisite-validation`). Open-reference warnings appear under the cohort (`components/OpenReferenceWarning.tsx`).

**Readiness checklist** (`pages/action-dashboard/actionReadiness.ts:97-167`):
- Dashboard: advisory, collapsed.
- Project page: four items gate staff testing.
- Suite launch: each unfinished item must be ticked "Ready to launch" or dismissed (`components/suite-launch/launchBlockers.ts:103-209`).
- It gates nothing on the dashboard's Events tab.

**Archive** (Overview toolbar, `useActionCommands.ts:119-143`):
- Archive asks "Confirm Archive"; unarchive asks nothing.
- Server: a plain flag write (`actions.service.ts:504-531`). Archived tasks are hidden from members and refuse update notifications.
- **Reminders still send for archived tasks** (no check, above).
- **Unarchiving a launched task shows it again at once, with no confirm.**

**Delete**: unreachable. The button is commented out (`components/ActionForm.tsx:303-312`; **#1028** removes the dead path). `DELETE actions/:id` still exists and refuses if the task is a prerequisite or referenced by a cohort (`actions.service.ts:472-485`).

**Cohort Decisions tab**: "Correct decision" assigns or excludes one member, with a required reason, in a modal (`components/CohortDecisionCorrectionModal.tsx`). It acts on a real member at once.

## 4. Operations that expose, notify or act on members

| Operation | Effect | Guard today (c722280863) | Where | #1028 |
|---|---|---|---|---|
| **Add event** on a task (Events tab, `components/CreateEventForm.tsx`) | A **non-Draft event exposes the task** once its date passes. The form is open by default (`EventManagementTab.tsx:26`), status defaults to Members taking action and **"Launch now" defaults to on** (`CreateEventForm.tsx:54, 74-78, 126-128`) | **None: one click on "Add Event" launches now.** The server takes any date, past included (`action-suites.service.ts:45-127`). Only a 409 when a deadline moves earlier on a launched task (`cohortDecisionStaffService.guardDeadlineShortening`); one member action event per task (unique index) | — / server | Typed confirm ("launch to real members") for **Members taking action only**. Planned, Office action, Completed, Failed or Abandoned still take a draft live with no confirm (left to ALL-2424) |
| Add **suite event** (suite page "+", same form in suite mode) | Added to **every task in the suite** (`action-suites.service.ts:214-233`) | Same as above: none | — | Same typed confirm for Members taking action |
| **Edit suite event "for all"** (`components/SuiteEventCard.tsx`) | Moves dates on every matching task. Matching is by sorted position and `suiteManaged` (`action-suites.service.ts:156-212`); moving the launch into the past launches now | None besides the deadline-shortening 409; no check against past dates | server (409 only) | **Not fixed** (ALL-2328) |
| Delete suite event | Removes it from every task; deleting the launch returns tasks to Draft | Overlay confirm; the server refuses if reminders depend on it | UI + server | — |
| Suite launch (`/suites/:id/launch`) | Creates the member event, office event and default reminders | Blockers, then a typed confirm with the count, a start-in-future re-check, and a re-read of the suite to refuse if it already launched (`SuiteLaunchPanel.tsx:186-228`, `launchSuite.ts`). Partitioned suites are refused on the server (`assertNoPartitionLaunch`) | UI, partition refusal on server | — |
| Project "Schedule release" (`pages/project-action/ScheduleReleaseForm.tsx:54-85`) | Member event, optional deadline, optional default reminders, in one transaction (`project-actions.service.ts:142-192`) | Typed confirm `many`. The server refuses past dates, an existing member event, and a shared suite (`:41-58, 149-161, 276-286`). **Staff testing first is UI-only**; the server doesn't check `staffPreview` | UI + server | — |
| Reschedule / unschedule release (`ScheduledReleaseEditor.tsx`) | Moves or deletes launch and deadline (and reminders) | Unschedule confirms. The server locks a passed launch (`project-actions.service.ts:201-214, 252-254`) | UI + server | — |
| Paste JSON with events | A task live at once | None | — | — |
| Duplicate | Copies `staffPreview`, `publicOnly`, visibility and suite. No events, so Draft, but **staff see it at once if preview was on**, and **anyone with the link can open it if `publicOnly`** | None (disabled while an image uploads) | — | Disabled while there are unsaved edits |
| Save Details on a live task | Content, cohort, visibility mode and `publicOnly` apply at once | Content confirm only. Server refuses optional → mandatory after decisions | UI + server | Leave guard, saved toast |
| Set `publicOnly` | **Page opens to anyone, even as Draft** | None | — | — |
| Visibility mode Public (the default) | Once launched, visible to everyone, cohort ignored | None; it is the default for new and project tasks | — | — |
| Staff preview on | Staff see the draft | None on the dashboard; four-item gate on the project page | UI | — |
| Save task form or variant form | Members get the new snapshot on next load | Builder gates (site links, formula refs, conflicts) | UI | — |
| Publish variants / change split | Assignment of members not yet assigned | Over-100% block (UI + server) | both | — |
| Update: first content save | Publishes the update to members who can see the task | None (a banner explains) | — | — |
| Update: Send notification | Push/inbox/email to the audience (all members possible) | `window.confirm`; the server refuses draft-at-arrival, archived, no body, a second send | UI + server | Typed confirm `many` |
| Create reminder group / populate defaults | Schedules sends | Typed confirm (skipped in development) | UI | — |
| **Edit reminder group** | Re-times or re-targets sends | **None** | — | — |
| Delete reminder group | Stops sends | Anchored confirm | UI | — |
| Archive / unarchive | Hide / **re-show** | Confirm on archive only. Reminders keep sending when archived | UI | Archived list toggle |
| Correct cohort decision | Assigns or excludes a member | Modal with required reason | UI | — |
| Member-action start (automatic) | Cohort decisions written (5-minute worker); **app-icon badge pushes** to members' devices from the per-minute sweep (`actions/task-badge.service.ts:33-140`); EventLaunch reminders fire | Nothing: it follows from the event | — | — |

## 5. Launching a task outside a suite vs. a suite launch

There are three ways a task outside a shared suite goes live:

1. **Events tab, Members taking action.** Usually "Launch now", optionally with "Automatically create deadline event" (off by default, `CreateEventForm.tsx:55`). It has no member count, no checks, no reminders (a task with no suite has no reminders UI at all) and, at this commit, no confirm. Any other non-Draft status also launches it.
2. **Project page "Schedule release".** Only for a task that is alone in its suite, which every project-created task is. The UI requires staff testing first (`pages/project-action/ReleasePanel.tsx:20-60`). It shows a live "Notify N members", needs the typed confirm, and can add default reminders. The server requires future dates.
3. **Paste JSON with dated events.**

A suite launch (see `cuj-suite.md`) adds blockers, per-task readiness, contract-violation acceptance, a member preview, text checks, a typed count, a re-read against a concurrent launch, and reminders that never send before members start. A task outside a suite gets none of that through route 1. Route 2 has the typed confirm and future-date refusal but no readiness review. If the task's suite holds other tasks, ReleasePanel and the server send staff to the suite page (`project-actions.service.ts:280-284`).

## 6. Once a task is live

- **Still editable with immediate effect**: all Details fields (content, cohort, visibility mode, `publicOnly`, prerequisites, completion flags, suite, project), the task form and variant forms (members get the new snapshot on next load), variant splits (new assignments only), new variants, follow-ups, updates, reminders, archive.
- **Refused by the server**: optional → mandatory once decisions exist (`actions.service.ts:375-384`); deleting a variant with assignments after launch (`action-form-variant.service.ts:244-255`); moving a release launch that has passed (`project-actions.service.ts:208-210`); unscheduling after launch (:254); a second member action event (unique index, `action-suites.service.ts:103-110`); a deadline moved earlier without acknowledgement (409); a second notification for an update.
- **Locked in the UI only**: release editor fields once passed (`ScheduledReleaseEditor.tsx`); reminder Edit hidden once finished.
- **Members mid-task**: forms have no versions pinned to a member in progress that I found. A form edit is live on next load, and responses record the snapshot they were submitted against (`forms.md` B102, R9). Assignments to variants are sticky, so a mid-task member keeps their variant. A cohort edit after launch changes only members without a saved decision. The resolver keeps deciding while enrollment is open (`cohort-decision.ts:39-101`).
- **Action events on the dashboard can't be edited or deleted** (`EventManagementTab.tsx`; inventory AD-35). Only suite events can.

## 7. Orderings

**Enforced by the server**
- A reminder needs a member action event (`reminder-group.service.ts:239`).
- An update notification needs a body, and needs the task non-Draft when the entries arrive (`action-update-visibility.ts:34-57`).
- An update needs a body before it is visible (`action-update-visibility.ts:8-23`).
- Variants need a task form (`action-form-variant.service.ts:127-132`).
- Schedule release needs a sole suite and future dates; no existing member event.
- One member action event per task.
- Partitioned suites can't launch.
- Optional can't flip to mandatory after decisions.

**Enforced by the UI only**
- Staff testing before Schedule release, and its four-item gate.
- Suite launch blockers and readiness ticks.
- Typed confirms (reminders, suite launch, release; #1028: event add and update send).
- Launch time in the future in the suite panel.
- Reminders not before members start (launch panel only).
- The task form saved before toggling it (project page).
- Variants staged before publish.

**Convention only** (nothing stops a different order)
- Building the task while Draft and launching last.
- Setting the cohort and visibility before any event.
- Creating reminders after the launch event but before members start.
- Writing an update's body before its date.
- Adding all tasks to a suite before the suite launches (a late joiner gets no suite dates).
- Checking readiness before using the Events tab.
- Turning off `publicOnly` until ready.

## 8. Not derivable from code

- Whether staff ever launch standalone tasks from the Events tab today, or always through a suite or project release, and whether "Launch now" is ever wanted.
- Whether `publicOnly` drafts being openable by id is intended (for sharing before launch) or an oversight.
- Whether visibility mode **Public** as the default for new and project tasks is deliberate, given that it ignores the cohort for visibility.
- How standalone (no-suite) tasks get reminders in practice, since there is no UI for it.
- Whether Planned, Abandoned or Failed events are ever added to drafts on purpose (to show "upcoming" or to close).
- Who reviews a task before launch, and whether staff preview is used on dashboard tasks or only on project ones.
- Whether editing a live task's form mid-week is normal, and how staff handle members partway through.
- Whether Paste JSON is used across environments with events ticked.
- Whether moving a task into an already-launched suite ever happens.

## 9. Traps for a redesign

1. **Any non-Draft event exposes a draft.** A merged "status" control (the prototype's Status dropdown), an "Abandon" command or a "Planned" marker implemented as an event takes a draft live. Only Members taking action gets a typed confirm, even after #1028.
2. **"Launch now" as the default date.** If a new Events dialog or a merged schedule step defaults to now, saving it launches. The server takes past dates on the generic event endpoint.
3. **Merging create and launch** (for example a "New task" wizard ending in a schedule step): the server will create the event before readiness, cohort or visibility are set. Defaults are Public visibility and no cohort, so the task would be visible to everyone, signed in or not.
4. **Making `publicOnly` an early, harmless-looking setting**: it opens the draft's page to anyone.
5. **Turning staff preview into an implicit preview** (e.g. enabled by "Preview as member"): staff see the draft, and staff are members.
6. **Treating update content and update sending as one step**: the first content save already publishes. A composer that saves as you type publishes on a live task. A "send now" with only an undo countdown drops the server's claim-once semantics if it retries.
7. **Moving reminders onto the task**: the server sends regardless of archived, Draft or preview state. The launch panel's "not before start" check is client-only, and editing a group has no confirm.
8. **Adding tasks to a launched suite from a pool**: the task gets no suite dates (stays Draft), but suite-scoped reminder recipients are computed from every suite task's cohort. Being in the suite can also change which task is "first", which drives general update dates and the reminders tab.
9. **Duplicate and Paste carrying flags**: Duplicate copies `staffPreview`, `publicOnly` and visibility (and unsaved edits). Paste can carry dated events, the suite by name, and `archived`.
10. **Unarchive with no confirm** re-exposes a launched task, and archive doesn't stop reminders.
11. **Suite-event edits launch unconfirmed** (ALL-2328 still open after #1028). An editable date cell in a table makes this one keystroke.
12. **Forms have no publish step.** An inline Form tab that autosaves changes the live task for members on their next load.
13. **Server checks are thinner than UI checks.** Staff testing, readiness, typed phrases and launch blockers all live in the client. A redesign that drops a screen drops the guard; the server won't catch it.

## 10. Prototype comparison (`prototypes/ref/screens-task.js`, `screens-tasks.js`, `screens-suites-projects.js`, `app.js`, `NOTES.md`)

Differences from today's order, or dropped guards:

1. **New task makes a task with no form at all.** Tasks header "New task" has no handler (`screens-tasks.js:107`). The palette "New task" toasts "Draft task created" (`app.js:337`). The suite's "New task" toasts "New draft task in …" (`screens-suites-projects.js:114`). Today nothing exists until "Create Action" with a name, and the defaults are known. The prototype doesn't say what a new task is pre-filled with (visibility, cohort, suite), or which screen opens.
2. **No project-page task creation, staff testing or Schedule release.** The project-scoped editor's gated phase header and typed release confirm have no equivalent, so the only standalone launch is the Events dialog.
3. **Paste JSON is gone.** Duplicate is a palette command that toasts (`screens-task.js:160`), with no statement of what it copies.
4. **Events tab "Add event" dialog** (`screens-task.js:47-58`):
   - a warning banner and a plain "Add event" button, with **no typed confirm**. #1028 adds one for Members taking action; the prototype doesn't have it;
   - the status list (`PHASES.slice(1)`) offers Office action, Resolution and Completed with the same weight as Members taking action, all of which take a draft live;
   - no "deadline event" option;
   - the default date is a fixed future date (safer than today's "Launch now"), but a past date isn't refused.
5. **Events have an edit pencil for the task's own events** (`screens-task.js:44`). Action events are not editable today. A date edit into the past would launch with no confirm, the same gap as ALL-2328.
6. **Status looks directly editable**: the sidebar "Status" has a dropdown chevron (`screens-task.js:118`). Status is derived from events, so any implementation adds an event (trap 1).
7. **"Abandon task…" command** (`screens-task.js:160`): on a draft this is an Abandoned event, which makes the task visible.
8. **"Post update" is the primary header button and `u` shortcut on every task, drafts included** (`screens-task.js:158-167`). The composer (`screens-task.js:129-144, 200-204`):
   - merges create, write and send into one step;
   - offers "Now";
   - sends after a **10-second cancel countdown with no typed confirm**. Today it is `window.confirm`, and #1028 makes it a typed phrase;
   - leaves out the server's draft-at-arrival refusal, the once-only rule, and the separate publish-on-content step;
   - "Save draft" has no stated visibility.
9. **Reminders and follow-ups become "messages" on the task** (Messages tab, composer type "Reminder" or "Follow-up", edit pencils, `screens-task.js:12-20, 80-92`). Today reminders are suite-level groups (first task only), creation needs a typed confirm with the count, and follow-ups are forms with a cohort and dates, not messages. The prototype drops the typed confirm, and puts editing a scheduled reminder one click away, which is already unguarded today.
10. **Variants tab** (`screens-task.js:73-78`) has "+ Variant" and no stage-then-publish, split editing, over-100% block or delete confirm. Adding one there would write straight away, and the warning about sticky assignment is gone.
11. **Details, readiness checklist, staff preview, `publicOnly`, visibility mode, cohort, prerequisites, completion flags, archive, follow-up forms and cohort decisions have no screen** on the task record. The sidebar marks Suite, Project and Audience as editable inline (`screens-task.js:116-126`), with no say on confirmation. `NOTES.md` already notes follow-ups have no tab. Without the readiness checklist on the task, standalone tasks have no pre-launch review at all.
12. **"Preview" button** ("Preview as member", `screens-task.js:164`) is unspecified. Today, staff preview makes the draft visible to all staff accounts, and the suite launch's member preview uses impersonation. Neither is safe to wire up casually.
13. **Suite "add an existing draft task"** (`screens-suites-projects.js:57-63, 115`) is offered only on draft suites, which avoids the late-joiner problem. It adds with an undo toast and no warning that suite membership changes reminder scope and general update dates. Today this is only possible from the task's Suite field.
14. **The Form tab embeds the live builder** with a banner that it also lives in Forms (`screens-task.js:152`), but **no warning that a save is live for members**. That is the same as today, though a tab one keystroke from the overview makes accidental edits likelier.
15. **The suite's Events tab** steers to Launch for draft suites with a toast (`screens-suites-projects.js:116`). For launched suites, "Add event (prototype)" does nothing, and it has no edit or delete-for-all with confirms.

Kept from today: the suite Launch tab's gates and typed phrase (`NOTES.md` §4), and the "Not visible to members" banners on draft tasks and suites.

## Summary

**Journey** (10 lines):
1. Create: `/actions/new`, suite-prefilled `/actions/new?suiteId`, project "New action" (own suite plus empty form), Duplicate, or Paste JSON. All Draft with no events, except a paste carrying events.
2. Details save sets content, cohort, visibility (default Public), suite, `publicOnly`, staff preview, prerequisites.
3. Task form and variant forms save live; variants are staged in the browser, then published one by one.
4. Follow-ups, updates (draft until a body is written) and project or priority are side steps.
5. Staff testing: an ungated toggle on the dashboard; gated on the project page.
6. Readiness checklist: advisory on the dashboard, a blocker only in the suite launch.
7. Launch: the suite Launch page (gated, typed), project Schedule release (typed, future dates), or the Events tab (one click, "Launch now" default).
8. Reminders exist only after a member event, live on the suite page, and send with no launched or archived check.
9. Update notifications: once only, refused while Draft at arrival; `window.confirm` today, typed after #1028.
10. Live: everything stays editable and applies at once; the server refuses only a few changes (optional → mandatory, assigned-variant delete, passed launch).

**Traps:**
- any non-Draft event exposes a draft, and "Launch now" is the default;
- Public visibility is the default, and it ignores the cohort;
- `publicOnly` drafts open by id;
- staff preview exposes to staff;
- the first update content save publishes;
- reminders have no server launch or archive check, and editing them has no confirm;
- suite-event edits launch unconfirmed (ALL-2328);
- Duplicate and Paste carry flags and events;
- unarchive re-exposes with no confirm;
- form saves are live;
- most guards are client-only.

**Prototype differences:**
- New task with no form or stated defaults; no project release or staff testing; Paste is gone;
- the Add-event dialog has no typed confirm and offers every status;
- task events and Status are editable, and "Abandon" is a command;
- "Post update" on drafts, with a 10-second countdown instead of a typed confirm;
- reminders and follow-ups merged into task messages without confirms;
- variants without staging or limits;
- no Details, readiness, `publicOnly`, visibility, cohort or archive on the task;
- an unspecified "Preview";
- suite add-task with no scope warning;
- the live Form tab without a warning.
