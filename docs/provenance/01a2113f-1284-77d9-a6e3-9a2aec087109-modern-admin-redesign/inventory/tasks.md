# Tasks-area functionality inventory

Read from the code at c722280863, then refreshed at ff886c540b after the rebase onto `main` took in #1028, #1088, #1089 and #1090. Line citations in the entries those PRs touched are to that revision, an entry they added or changed names the PR, and what they removed is marked **Removed** in place with its ID kept. This inventory is the checklist the redesign is verified against, so that nothing staff can do today is lost. It was written against the prototype's page map before the corrections in this directory's `PLACES.md`: a `PLACES.md:<line>` citation refers to that earlier version, and where a note here says the map lacks something or adds something new, `PLACES.md` is the current answer.

Scope: `/projects`, `/projects/:projectId`, `/projects/:projectId/action/:actionId`, `/actions`, `/actions/:actionId` (including `/actions/new` and every tab), `/actions/:actionId/updates/:updateId`, `/timeline`, `/suites/:suiteId` (including partitioning), `/suites/:suiteId/launch`, `/new-suite`, `/priority`, `/scheduled`, `/contracts`, `/contracts/:id` (including `/contracts/new`), `/formulas`, `/formulas/:formulaId` (including `/formulas/new`).

Paths are relative to `apps/admin/src/` unless they start with `shared/`, `sharedweb/` or `common/`. Capability IDs (`PR-3`, `AD-41` …) let the redesign check items off.

Cross-cutting behaviour that applies to several routes:

- **X-1 Content confirm** (`components/useContentConfirm.tsx:191`): before a save, any absolute link to the site (`thealliance.org`/legacy host) or any mention of "worldalliance" opens a "Save anyway?" dialog listing excerpts in two sections (site links should be paths; worldalliance mentions). Cancel aborts the save. Used by action details save, action update details save, contract save, and reminder group save.
- **X-2 ConfirmDialog keyboard** (`components/ConfirmDialog.tsx:34`): Enter confirms while the panel itself has focus (not on a `destructive` dialog, not on held-key repeats, not Shift+Enter, not when focus is on an inner control); Escape cancels; a backdrop click does nothing; both buttons are disabled while `isLoading`.
- **X-3 Leave guard** (`lib/useLeaveGuard.ts:29`, `components/LeaveGuard.tsx:6`; changed in #1028 and #1090, which replaced `lib/useUnsavedChangesPrompt.ts`): browser `beforeunload` plus an in-app prompt, `window.confirm("You have unsaved changes. Are you sure you want to leave this page?")`. One `LeaveGuard` wraps every admin route (`adminlayout.tsx:19-21`) and owns the single router blocker, which asks every mounted guard, so a clean page still prompts for a dirty editor nested in it. A guard can let search-param changes on its own path through (`allowSamePath`). A page's own navigation to the record it just saved runs unprompted past that page's guard only, and once that navigation lands, the page it left no longer blocks the next navigation (#1090). Used by the action details editor (AD-53, PA-11), the action update details (AU-13), the formula editor (FE-10), the suite partition editor (SU-5), and the member list editor and form builder (Members and Forms inventories).
- **X-4 Deadline-shortening confirm** (`lib/confirmDeadlineShortening.ts:10`): when the server answers 409 to a schedule edit that moves assigned members' deadline earlier, it asks "Move the deadline earlier?" with the server's explanation and resends with `acknowledgeDeadlineShortening=true`. Declining cancels. Used by action event add, suite event add/edit, and release reschedule.
- **X-5 Typed confirms** (`lib/notifyRealMembers.ts:1`): fullscreen confirms that need the text `I am going to notify <N|many> real members` typed. Used by schedule release, suite launch, populate default reminders and create reminder group (those two skipped in `development` mode), and, since #1028, an update's Send notification (AU-6, with `many`).
- **X-6 Refusal messages**: server refusals are shown with their own text (`lib/adminRefusal.ts`, `thrownRefusalMessage`); a 401 shows a session-expired message (`lib/sessionExpired.ts`).
- **X-7 Sidebar**: Projects and Actions are top-level entries; Priority, Scheduled Plans, Contracts and Formulas sit in the "Action Planning" folder (`components/adminNavEntries.tsx:65-83`). `/timeline`, `/new-suite`, suites, and action/update records have no nav entry.
- **X-8 Launch confirm** (added in #1028; `components/CreateEventForm.tsx:24-35,144-160`): adding an event that sets the Member action status, from an action's Events tab (AD-34) or a suite's events (SU-6), opens a fullscreen confirm that needs `launch to real members` typed. Title "Launch to members now?" when the event is immediate or its time has passed, else "Schedule this launch?"; the message says whether this action or every action in the suite opens, and when; in a suite it adds "This skips the suite launch checks." Cancel sends nothing. Events that set any other status add without asking. Not skipped in `development` mode.
- **X-9 Confirms that follow the page** (added in #1028; `lib/useConfirmOnPage.ts:15`, `sharedweb/ui/ToastProvider.tsx:108,214-228`): a confirm asked through `useConfirmOnPage` closes as declined when the path changes or its caller unmounts, and stays open across a search-param change, so a write can't land on a record staff reached after the question opened. Used by X-8 and AU-6.
- **X-10 Browser tab titles** (changed in #1028): pages in this group title the tab `<page or record name> - Admin`: "Actions - Admin", "<action name> - Admin" / "New action - Admin", "<project name> - Admin", "Projects - Admin", "<suite name> - Admin", "Launch <suite> - Admin", "New suite - Admin", "Scheduled plans - Admin" (`pages/Actions.tsx:140`, `pages/ActionDashboard.tsx:157`, `pages/ProjectActionPage.tsx:66`, `pages/ProjectDetailPage.tsx:197`, `pages/ProjectsPage.tsx:96`, `pages/ActionSuitePage.tsx:88,107`, `pages/SuiteLaunchPage.tsx:18`, `pages/NewActionSuitePage.tsx:41`, `pages/ScheduledPlansPage.tsx:79`).

---

## 1. `/projects`: projects list

**New place:** Tasks › Projects › Projects list (`#/tasks/projects`).
**Purpose:** a board of every project and every standalone action, grouped by lifecycle, with health flags and a completion funnel.
**Page:** `pages/ProjectsPage.tsx`

**Capabilities**
- PR-1 Header "Projects" with a **+ New project** icon button. It turns into an inline name input (`components/ProjectNameInput.tsx`): Enter or Save creates the project, Escape or Cancel closes it, Save is disabled while blank or saving, the input is read-only while saving, and a failure toasts "Could not create the project" (`pages/ProjectsPage.tsx:32-61`).
- PR-2 Sections in order: Live, Upcoming, In the works, "Awaiting office/resolution", Done. Each heading has a card count, and empty sections are hidden (`pages/ProjectsPage.tsx:16-22,101-104`).
- PR-3 The Done section is collapsible and collapsed by default (chevron, `aria-expanded`). The others are always open (`pages/ProjectsPage.tsx:24-30`). Collapse state is not in the URL.
- PR-4 A card's section is the most active bucket among its steps: Live > Upcoming > In the works > Awaiting > Done. A project with no steps goes to In the works. A draft with a launch ahead counts as Planned (`lib/projectCards.ts:139-161`).
- PR-5 Cards are sorted by most recent start, unstarted last, then by name (`lib/projectCards.ts:279-281`). The grid is responsive, with tiles at least 420px wide.
- PR-6 Project card (`components/ProjectCardTile.tsx`) shows: the name (whole card links to `/projects/:id`), category icons with tooltips, "Started/Starts <date>" or "Not started", and coloured counts per bucket (live/planned/draft/wrapping up/done) (`components/ProjectCardBody.tsx:33-52`).
- PR-7 Standalone action card: one card per non-archived, non-onboarding action with no project. It shows a "Standalone action" chip and links to `/actions/:id` (`lib/projectCards.ts:314-333`).
- PR-8 **Make a project from this action** (FolderPlus button on standalone cards): an inline name input prefilled with the action name. It creates the project, assigns the action to it, then navigates to `/projects/:newId` (`components/ProjectCardTile.tsx:13-54`).
- PR-9 Health flags (amber rows): stuck in office action/resolution ≥21 days with no posted update since; completed ≥21 days with no posted update; deadline within 72h; launch within 72h; "Nothing planned after <last live step>" (projects only) (`lib/projectCards.ts:130-229`, copy at `components/ProjectCardBody.tsx:20-31`).
- PR-10 Mini timeline: one lane per step, with phase bars (member-action bars in the project's swatch colour, others grey; completed phases omitted), a red "Now" line, start and end dates, and bar tooltips "<step>: <status> (date – date)". "No events scheduled" when empty (`components/ProjectMiniTimeline.tsx`).
- PR-11 Step rows (`components/ProjectStepRows.tsx:93-207`): number, name (links to the project-action page if in a project, else `/actions/:id`), status chip plus participant cohort summary (`ActionTimelineRowMeta`), dates "MMM d – MMM d" / "From …" / "Unscheduled", completions "N done" with retention % versus the previous step (tooltip), and a funnel bar.
- PR-12 Card footer totals: completions, "won't" (withdrawn), and dismissed (`components/ProjectCardBody.tsx:98-111`).
- PR-13 Load states: "Loading projects...", or the failure message (actions or projects load error) (`pages/ProjectsPage.tsx:68-77`).

**Data:** `useProjectsPageData` (`lib/useProjectsPageData.ts`) → `useActionsAdmin` (`shared/lib/useActionsAdmin.ts`, `actionsFindAllWithDraftsAdmin`, archived filtered out) plus `useProjectsAdmin` (`projectsFindAllAdmin`), participants via `useActionParticipants` (`useTagsAdmin`, `useFormDisplaySlugs`). Create: `useCreateProjectAdmin` → `projectsCreateAdmin` (+ `projectsAssignActionAdmin`), which invalidates projects, `actionAdminAll` and `actionsAllAdmin` (`lib/useProjectsAdmin.ts:47-106`).
**Shared code:** `sharedweb/ui/ToastProvider`, `sharedweb/ui/Button`, `common/errorMessage`, `sharedweb/ui/Tooltip` (category icons), `chroma-js` swatches (`lib/identitySwatch`).
**Tests:** `pages/ProjectsPage.test.tsx` (sections, 3-day deadline flag plus timeline, make project prefilled, Done collapsed, create, failed load); `lib/projectCards.test.ts` (start/order, counts, planned-draft, funnel, archived and onboarding excluded, standalone cards, sort, each flag); `lib/useProjectsAdmin.test.ts` (invalidation order: success reported only once the list has the project).
**Notes:** archived and onboarding actions never appear (`lib/projectCards.ts:283`). The flag thresholds are hard-coded (21 days, 72h).

---

## 2. `/projects/:projectId`: project record

**New place:** Tasks › Projects › Project record (`#/project/:id`; tabs Tasks by suite, Timeline, Task updates).
**Purpose:** edit one project and manage its steps (add, remove, create, start staff testing).
**Page:** `pages/ProjectDetailPage.tsx`

**Capabilities**
- PD-1 "← Projects" back link. Not found shows "Project not found." plus a "Back to projects" link (`pages/ProjectDetailPage.tsx:179-204`).
- PD-2 Inline edit of the **name** (pencil, then ProjectNameInput with Enter/Escape) and the **slug** (monospace, pencil). Saving closes the editor, and an error toasts "Could not update the project" (`pages/ProjectDetailPage.tsx:58-123`).
- PD-3 **Category picker**: toggle buttons for Environmental destruction, Extreme poverty, Democratic institutional decline, Dangerous technological development, and Meta (`aria-pressed`, tooltips). Each toggle saves immediately and is disabled while saving (`pages/ProjectDetailPage.tsx:105-111`; `components/ActionCategoryIcons.tsx:21-25,62`).
- PD-4 **Delete project** (red) → ConfirmDialog "Delete project '<name>'?" / "Its N actions stay and become standalone." Confirming navigates to `/projects`; the button shows a spinner while loading (`pages/ProjectDetailPage.tsx:124-140`).
- PD-5 Summary row: started text plus bucket counts (`pages/ProjectDetailPage.tsx:206-209`).
- PD-6 Detailed card body (`detailed`): flags, a taller mini timeline, and step rows that add the slug, a phase pill (Draft/Staff testing/Scheduled/Live or the closed bucket label; `components/ActionPhasePill.tsx`), and the "won't · dismissed" per step (`components/ProjectStepRows.tsx:135-190`).
- PD-7 Per-step next action: **Start staff testing** for Draft steps (disabled with a tooltip "Needs: …" listing missing short description, body, task form, cohort; sets `staffPreview=true`), and a **Schedule release** link for Staff-testing steps (to `…/action/:id#release`) (`components/ProjectStepRows.tsx:32-91`).
- PD-8 **Remove step** (X) → unassigns the action from the project immediately, with no confirm (`pages/ProjectDetailPage.tsx:215-217`).
- PD-9 **New action** button → modal "New action" with Name and Short description (both required; Create disabled while blank or pending). The server error is shown inline. On success it navigates to `/projects/:id/action/:newId` (`components/NewProjectActionDialog.tsx`).
- PD-10 **Add action** searchable select: every non-archived, non-onboarding action not already in this project. Actions in another project are labelled "<name> (in <project>)", and picking one moves it (`pages/ProjectDetailPage.tsx:191-255`).

**Data:** `useProjectsPageData`, `useUpdateProjectAdmin` (`projectsUpdateAdmin`), `useDeleteProjectAdmin` (`projectsRemoveAdmin`; invalidates without the details query to avoid a 404), `useAssignActionProjectAdmin` (`projectsAssignActionAdmin`), `useStartStaffTestingAdmin` (`actionsUpdateAdmin {staffPreview:true}`), `useCreateProjectActionAdmin` (`projectActionsCreateAdmin`) (`lib/useProjectsAdmin.ts`).
**Shared code:** `sharedweb/forms/SearchableSelect`, `shared/forms/optionSections`, `sharedweb/ui/Button`, `sharedweb/ui/Modal`, `ConfirmDialog`.
**Tests:** `pages/ProjectDetailPage.test.tsx` (steps with responses, not found, remove step, confirm-then-delete returns to list); `lib/staffTestingGate.test.ts` (whitespace counts as empty).
**Notes:** project data comes from the list endpoint (`projectsFindAllAdmin`), not `projectsFindOneAdmin`. PLACES lists Timeline and Task updates tabs that don't exist today, so they would be new.

---

## 3. `/projects/:projectId/action/:actionId`: project-scoped action editor

**New place:** Tasks › All tasks › Task record, with the breadcrumb through its project.
**Purpose:** a streamlined, release-oriented editor for one step of a project: phase, checklist, details, task form, and release scheduling.
**Page:** `pages/ProjectActionPage.tsx`

**Capabilities**
- PA-1 Redirects (replace) to the right URL when the action isn't in this project: `/projects/<real>/action/:id` or `/actions/:id` (`pages/ProjectActionPage.tsx:48-59`).
- PA-2 "← <project name>" back link, `<h1>` action name, and a **Full dashboard ↗** link to `/actions/:id` (`pages/ProjectActionPage.tsx:67-83`).
- PA-3 **Phase header**: phase pill, plus **Start staff testing** (Draft) or **Stop staff testing** (Staff testing). Disabled while busy, while there are unsaved edits (shows "Save your changes first"), or while gate items are missing. In that last case it lists "Needed before staff testing: …" with anchor links to `#details` / `#task-form` (`pages/project-action/PhaseHeader.tsx`). Saves `staffPreview` immediately (`pages/action-dashboard/useActionEditor.ts:215-229`).
- PA-4 **Readiness checklist** (expanded by default here): see AD-25.
- PA-5 **Action details form** (`ActionEditor` without the Staff preview toggle; `hideStaffPreview`): every field and rule in AD-20..AD-33, with the save toast of AD-33 and the late-save rule of AD-54. (This entry used to cite AD-27..AD-40, which was never the details form's range.)
- PA-6 **Task form** card, collapsed by default. The toggle opens the full FormBuilder for the linked form (or creates one named "<action> form"). The toggle is disabled with the title "Save the task form first" while the builder has unsaved changes. Builder dirtiness also disables the phase and release buttons (`pages/ProjectActionPage.tsx:122-144`).
- PA-7 **Release panel** (`pages/project-action/ReleasePanel.tsx`, anchor `#release`):
  - no suite → "Schedule it from Events" (link `/actions/:id?tab=events`; the tab was named Event Management before #1028);
  - the suite has other actions → "Schedule it from the suite page" (link);
  - Draft → "Start staff testing to schedule the release.";
  - Staff testing → **Schedule release form**;
  - Scheduled/Live/Closed → **Scheduled release editor**.
- PA-8 **Schedule release form** (`pages/project-action/ScheduleReleaseForm.tsx`): Launch (Pacific `datetime-local`, default next Tuesday 6pm PT, `lib/releaseDates.ts:9`), a Deadline checkbox (on by default; default launch +7 days 11:59pm PT) with "Then" Office action or Completed, and a "Default reminders" checkbox (Announcement plus deadline presets). It shows a live "Notify N members on <PT date>" from cohort evaluation, validates the deadline is after the launch, and needs the typed confirm X-5. It is disabled while evaluating or if evaluation fails (error shown).
- PA-9 **Scheduled release editor** (`pages/project-action/ScheduledReleaseEditor.tsx`): edit launch and deadline (each locked once passed). **Save dates** sends only the changed ones in one request (X-4 applies) and is hidden once the deadline has passed. **Unschedule release** (before launch) confirms "Deletes the launch and deadline events and their reminders, and returns the action to staff testing."
- PA-10 Error banner (`role=alert`) for save and staff-preview failures (`pages/ProjectActionPage.tsx:93-99`). It no longer reports delete failures: #1028 removed the delete code path (see Notes).
- PA-11 **Leave guard on the details form** (added in #1028; X-3; `pages/action-dashboard/useActionEditor.ts:337-346`): leaving with unsaved details, or while a cover image is still uploading, prompts. The task form builder inside the card carries its own guard (Forms B13), and both are asked.

**Data:** `useActionAdmin` (`shared/lib/useActionAdmin.ts`: `actionsFindOneAdmin`, `actionsUpdateAdmin`…; `actionsRemoveAdmin` is no longer called, #1028), `useAdminTaskForm`, `useActionEditorLookups` (see AD), `useActionSuiteAdmin` (release panel), `useActionReleaseAdmin` → `projectActionsScheduleReleaseAdmin` / `RescheduleRelease` / `UnscheduleRelease` (`lib/useProjectsAdmin.ts:161-195`), `useCohortEvaluationAdmin` → `actionsEvaluateCohortAdmin`.
**Shared code:** `sharedweb/ui/Card`, `sharedweb/ui/Button`, `ToastProvider` (`ConfirmMode.Fullscreen`, `requiredText`), `@date-fns/tz`.
**Tests:** `pages/project-action/ScheduleReleaseForm.test.tsx` (failed member count refuses scheduling); `ScheduledReleaseEditor.test.tsx` (launch and deadline saved in one request); `lib/releaseDates.test.ts` (Tuesday rules, DST, Pacific day near midnight, parse/format round trip); `lib/actionPhase.test.ts`; `pages/action-dashboard/actionEditorLeaveGuard.test.tsx` covers the editor hook's guard (AD-53). There is no page-level test.
**Notes:** **Removed in #1028:** the page no longer wires a delete handler at all. `handleDelete`, `ActionForm`'s `onDelete` prop and its commented-out Delete button, and `useActionAdmin().removeAction` are gone, so deleting an action has no client code path (it was already unreachable; see AD notes). The details form now has a leave guard (PA-11). This page duplicates much of the action dashboard's Details tab.

---

## 4. `/actions`: actions list

**New place:** Tasks › All tasks › List view (`#/tasks`).
**Purpose:** a Gantt overview of actions (archived ones on request) plus suite-grouped lists, and the entry point to create actions and suites.
**Page:** `pages/Actions.tsx`

**Capabilities**
- AL-1 Gantt (`components/ActionTimeline.tsx`, capped at 50vh) of the actions filtered by status bucket, archived ones only when AL-9 is on, latest launch first with drafts on top (`pages/Actions.tsx:64-66,200-242`; `lib/actionTimelineData.ts:279-338`).
- AL-2 **Status bucket filter** (header dropdown "Actions · <summary>"): checkboxes for Active, Pending, Draft, Onboarding and Completed. The default is Active+Pending+Draft. The summary reads "All", "None" or a list. **Changed in #1028: the selection is in the URL** as `?status=` (comma-separated bucket names in enum order, left out at the default, an empty value for none, unknown names ignored, other params kept), so a link or Back restores it; it was React state before (`components/ActionStatusBucketFilter.tsx`; `lib/actionListBuckets.ts`; `pages/Actions.tsx:44-53`). Buckets: onboarding wins over status; planned/office/resolution/failed/abandoned count as Pending (`lib/actionStatusBucket.ts:19-43`).
- AL-3 **Create menu** (a green "+ Create" button; an icon-only "+" before #1028): New action (`/actions/new`), New suite (`/new-suite`), and **Paste JSON**, which reads the clipboard, calls `actionsPasteJsonAdmin`, navigates to the new action and toasts "Action pasted", or toasts the server's refusal (`components/CreateActionMenu.tsx`).
- AL-4 Gantt chart details:
  - fixed 320px name column (each row links to `/actions/:id` and shows a status chip, an "archived" chip on archived actions (#1028, `components/ActionTimelineRowMeta.tsx:60-69`), and a participants summary with a tooltip of the full cohort text; US/non-US member chips are coloured);
  - week ticks at 16px/day showing the week number, date and month; clicking a week header scrolls to the first action active that week;
  - phase bars: member-action bars in the project/slug/name swatch colour, others grey, completed transparent; the last phase fades out after now; tooltips "<name>: <status> (dates)"; a bar click opens the action;
  - "Now" line, initially centred on now; hovering a row highlights every row of the same project; the names pane and chart scroll vertically in sync;
  - empty state "No actions with timeline events found." by default. On `/actions` (#1028) it reads "No actions match the selected statuses." when the filter hides every action, or "Every action is archived." with a **Show archived actions** button that turns AL-9 on and moves focus to its checkbox. The header controls stay mounted, keeping focus and an open menu, as the chart empties or fills (`components/ActionTimeline.tsx:36,51,201-222`; `pages/Actions.tsx:222-241`; `ActionTimelineBar.tsx`, `ActionTimelineRowMeta.tsx`).
- AL-5 **Suites with draft or active actions** cards: suite link plus counts per bucket ("2 draft · 1 active"), and each draft or active action as a link with a bucket chip, without nested links (`pages/Actions.tsx:243-298`; `lib/inProgressSuites.ts`).
- AL-6 Grouped list "Grouped by suite and ordered by latest event (most recent first)": one box per suite (header links to `/suites/:id`; "No suite" group) with `ActionListCard` rows. With archived actions shown (AL-9) the caption adds ", with suites whose actions are all archived last" and those suites sort last. The caption and list are hidden when no group has actions (`pages/Actions.tsx:71-138,299-336`).
- AL-7 `ActionListCard` (`components/ActionListCard.tsx`): Archived chip (grey), bold name, "Last event <date, time and time zone>", status chip with its label ("Member action"; green tint for member_action; the raw enum before #1028), Optional chip, short description, and a progress bar ("N / M completed"; hidden for drafts; "Joined/Completed" when nobody joined) (`components/ActionProgressBar.tsx`). The whole row is a link to `/actions/:id` (a click handler before #1028, so it now opens in a new tab and takes keyboard focus).
- AL-8 Empty state, only when there are no actions at all, archived included: "No actions yet. Create one to get started." plus the Create menu (when every action is archived the page renders with AL-4's message instead). Load: "Loading actions...". A failure with no data shows the error only. A refetch error shows above the kept list. Errors are `role=alert` (`pages/Actions.tsx:140-194`).
- AL-9 **Show archived** (added in #1028; `pages/Actions.tsx:54-62,207-216`): a checkbox in the Gantt header, held in the URL as `?archived=1`. On, archived actions join the Gantt (AL-4 chip), the in-progress suite cards and the grouped list (AL-6, AL-7 chip). Before #1028 archived actions could not be listed anywhere in the admin.
- AL-10 **Announced filter result** (added in #1028; `pages/Actions.tsx:147-162`): a visually hidden `role=status` region, mounted from the first render, announces "Every action is archived." or "No actions match the selected statuses." when that state arrives.

**Data:** `useActionsAdmin` (`actionsFindAllWithDraftsAdmin`), `useActionParticipants`, `useActionAdmin(null).pasteActionJson` (`actionsPasteJsonAdmin`).
**Shared code:** `common/actionEvent.eventInEffectAt`, `sharedweb/ui/DropdownMenu`, `@base-ui/react/menu`, `sharedweb/ui/zIndex`, `shared/styles/util.cn`.
**Tests:** `pages/Actions.test.tsx` (archived hidden, load failure, 401, refetch error beside list, write shown after invalidate, empty plus create menu, suite card links not nested; since #1028: archived listed and marked once shown, shown from a link, Back steps through the toggle, status menu stays open with focus as its last match filters out and back, the status region's wording, all-archived suites last, statuses read from and written to the URL); `lib/actionListBuckets.test.ts`; `components/ActionTimeline.test.tsx` (empty, colour by project, project hover, week-header scroll, reminder click); `components/CreateActionMenu.test.tsx`; `lib/inProgressSuites.test.ts`; `lib/actionStatusBucket.test.ts`; `lib/actionTimelineData.test.ts`.
**Notes:** #1028 fixed three things noted here before: the list card's raw status enum (AL-7), the "Admin panel" page title (X-10), and the archived branch of the suite grouping, which is live now that archived actions can be shown (AL-9). Still true: `ActionTimeline`'s `focusOnDate` prop has no caller (dead, `components/ActionTimeline.tsx:33,85-164`). The sticky bar label renders an empty div; its text is commented out (`components/ActionTimelineBar.tsx:190-213`).

---

## 5. `/timeline`: experimental timeline

**New place:** Tasks › All tasks › Timeline view.
**Purpose:** today, a stub zoomable day ruler with no data.
**Page:** `pages/NewTimelinePage.tsx` → `components/NewActionTimeline.tsx`

**Capabilities**
- TL-1 Grey strip with day-number ticks over a fixed 14-day window centred on page load, and a blue "now" line (`components/NewActionTimeline.tsx:48-83`).
- TL-2 Mouse wheel: vertical delta zooms (changes the visible width), horizontal delta pans. Prevents page scroll (`components/NewActionTimeline.tsx:29-46`).

**Data:** none. **Shared code:** none. **Tests:** none.
**Notes:** not linked from the sidebar or anywhere else (X-7). It shows no actions. The real timeline capability lives in `ActionTimeline` on `/actions` and `/suites/:id`; PLACES' "Timeline view" should be built from those, not from this stub.

---

## 6. `/actions/:actionId` (and `/actions/new`): action dashboard

**New place:** Tasks › All tasks › Task record (`#/task/:id`; tabs Overview, Form, Variants, Messages, Responses, Activity).
**Purpose:** everything about one action: status and reports, editing, events, task form, A/B variants, updates, follow-up forms, responses, cohort decisions.
**Page:** `pages/ActionDashboard.tsx`

### Header and shell
- AD-1 Tabs in URL `?tab=` (`lib/useSearchParamTab.ts`): `overview` (default) "Status overview", `details` "Action details", `events` "Events" ("Event Management" before #1028), `updates` "Updates", `form` "Task form", `form-variants` "Form variants", `follow-up-forms` "Follow-up forms", `responses` "Responses", `cohort-decisions` "Cohort decisions". An unknown tab falls back to the first. The active tab button carries `aria-current="page"` (`pages/ActionDashboard.tsx:26-149,242-261`).
- AD-2 **View action page** opens the member site `/actions/:id` in a new tab. Since #1028 it sits at the top right of the header beside Back, shown only once the action has loaded; it was the last item of the tab bar (`pages/ActionDashboard.tsx:187-196`).
- AD-3 Header: Archived chip (grey), action name (or "Create new action"), category icons (only when not in a project), and a "← Back to actions" link to `/actions` (`pages/ActionDashboard.tsx:158-204`).
- AD-4 **Slug field**: click to edit inline (Enter saves, Escape or blur cancels, inline error), plus a **Copy slug** button with "Slug copied" toast (`components/SlugField.tsx`).
- AD-5 "Before writing copy, read the action copy guidelines." link (Google Doc) (`pages/ActionDashboard.tsx:206-217`).
- AD-6 Error banner that scrolls itself into view. It also reports "Failed to load the other actions, so prerequisites and cohort action conditions can't be picked…" (`pages/ActionDashboard.tsx:69-81,218-226`).
- AD-7 **Linked text selection**: `?tab=details&field=name|shortDescription|body&from=&to=&text=` focuses and selects that range in the field and scrolls it to centre. If the text changed or can't be found it shows an error. The params are removed afterwards. Used by launch text findings (`lib/linkedSelection.ts:117-132`).
- AD-8 `/actions/new?suiteId=N` renders only the create form (suite prefilled). Create toasts `Saved "<name>"` and navigates to `/actions/:newId` without the leave prompt; Cancel goes to `/actions` (and prompts if the form has edits, AD-53) (`pages/ActionDashboard.tsx:228-235`; `useActionEditor.ts:174-196,393-406`).

### Overview tab (`pages/action-dashboard/ActionOverviewTab.tsx`)
- AD-9 Toolbar (`ActionDashboardToolbar.tsx`):
  - **project picker** (searchable: "No project" or any project; assign immediately), **Rename project** (pencil, inline), and **New project for this action** (+, inline name; creates and assigns) (`components/ActionProjectControls.tsx:35-144`);
  - **Open in project** link (if in a project) and **Open suite** (if in a suite);
  - **Duplicate action**: disabled while the cover image uploads and, since #1028, while Action details has unsaved edits, when it shows "Save your changes on Action details to duplicate this action." It clones the task form as "<title> (Copy)", creates "<name> (Copy)" with copied images, toasts "Action duplicated" and navigates to it (`useActionCommands.ts:48-105`; `ActionDashboardToolbar.tsx:69-83`);
  - **Export JSON** dropdown with Events / Task form (default on) / Suite checkboxes; it copies the export JSON to the clipboard (Safari-safe), the button reads "In clipboard" for 2s, and a failure toasts (`useActionExport.ts`);
  - **Archive action / Unarchive action**. Archive asks "Archive this action?" with what it does: "Only admins can open it." (or, for a public-only action, "Its public page stays open to anyone with the link.") "It also leaves the actions list unless archived actions are shown.", confirm label Archive. Unarchive doesn't ask (`useActionCommands.ts:107-133`).
- AD-10 Failed-loads banner listing which reports failed ("invite stats", "withdrawn count" / "withdrawn and dismissed counts", "form responses", "users who failed to complete") (`useActionReporting.ts:99-124`).
- AD-11 Project steps card (if in a project): project name, **category picker**, **Delete project** (ConfirmDialog "Its N action(s) will no longer belong to a project…"), and the step list with member-action dates. Other steps link to `/actions/:id?tab=overview` (`components/ActionProjectControls.tsx:146-238`).
- AD-12 Status card: a status pill, a real button since #1028 (label "<status>: open events"), that goes to the Events tab and moves focus to that tab's button, and Completion progress "completed / joined (x%)" with a bar (`ActionOverviewTab.tsx:76-120`; `pages/ActionDashboard.tsx:87-92`).
- AD-13 Participation stat cards (only once member action has started): Completion rate, "Expected to complete" / "Able to complete" (optional), Completed, Withdrawn, **Failed to Complete** (non-optional, click expands the list), Dismissed (optional only) (`ActionParticipationStats.tsx:35-130`).
- AD-14 "Users who failed to complete" list: avatar plus name links. It loads only for statuses office_action/resolution/completed/failed/abandoned (`useActionReporting.ts:26-35`).
- AD-15 **Completion over time** chart (non-public, non-optional, started): Daily vs Hourly CDF toggle, Duration (days) min/max filter defaulting to ±3 days of this action's duration, "Clear filter", and hover details (`components/ActionCompletionCurveChart.tsx`).
- AD-16 Timeline card: events newest first, with the current event's dot highlighted. Empty: "No events yet. This action is in Draft status by default." (`ActionOverviewTab.tsx:129-164`).
- AD-17 Public-only actions: an **Invite Stats** table (member, form submissions, interested in joining) and a total of public submissions (`ActionResponseReports.tsx:28-85`).
- AD-18 **Response Statistics (N responses)** with **View All Responses →**. Clicking a statistic jumps to `?tab=responses&resp_tab=replays&resp_filterField=…&resp_filterOp=…&resp_filterValue=…` (`ActionResponseReports.tsx:87-124`).

### Details tab (`ActionEditor` → `components/ActionForm.tsx`, fields from `lib/actionFieldDefs.ts`)
- AD-19 Readiness checklist (collapsed by default here; header "x/y ready", green when complete). The items are listed in AD-25 (`ActionReadinessChecklist.tsx`).
- AD-20 Cohort parse failure: a warning that saving is disabled, and the Save button is disabled (`ActionEditor.tsx:93-103`; `useActionEditor.ts:354-359`).
- AD-21 Content section: **Name** (textarea, 1 row, required: the browser blocks an empty one and a name of only spaces is refused with "Give the action a name.", cleared once a name is typed), **Short description** (2 rows) and **Action page description** (markdown textarea), neither marked required since #1028 (they are readiness items, AD-25), **Cover image** (file picker; upload with "Uploading..." and a cancel that keeps the current image; error text; preview; current image shown when editing), **Square thumbnail URL**, and **Thumbnail alt text** (help: "Left empty, the thumbnail is announced as the action name.") (`lib/actionFieldDefs.ts:95-136`; `useActionEditor.ts:51,302-304,366-369`).
- AD-22 **Action authors** multi-user select (loading and failure states) (`ActionForm.tsx:163-170`).
- AD-23 **Reviewed by** editor: rows of Name, Link (optional), and Icon (Auto, which detects LinkedIn from the link, / None / LinkedIn), with Remove and "+ Add reviewer". Links get `https://` added on save, and blank names are dropped (`components/ActionReviewersEditor.tsx`; `useActionEditor.ts:375-384`).
- AD-24 Settings section: **Manage priority** link to `/priority` (an in-app link since #1028, so it goes through the leave guard instead of reloading the page), **Category** picker, **Suite** select ("Fetching suites..." help), **Visibility mode** (All members / Participating groups / Public), **Task** (Form / Kora review, with help), **Time estimate (min)**, and the **Staff preview** switch (with help; hidden on the project page) (`ActionForm.tsx:180-191`; `lib/actionFieldDefs.ts:138-195`).
- AD-25 Readiness items: Short description*, Full body content*, Time estimate set, Part of a suite, Part of a project, Cohort expression set*, Action authors set, Task form linked*, Image set, "Task form has an output view, for the completion card", and "Total reading time: Xm Ys - (N description words + M form words)" (ready when under 15 min, at 0.462 s/word). * = "Required for staff testing" (`pages/action-dashboard/actionReadiness.ts:97-167`).
- AD-26 Collapsible sections that open automatically when one of their fields is set: **Audience** (Onboarding: "Members with a contract can complete it only if they signed their first one after the Member action event starts"; Public only), **Completion** (Complete after deadline, Prevent completion, Optional, the last hidden when the suite's partition sets it or suites are unknown), **Forum participation** (Forum participation action → Forum post ID (override), Include child replies), and **Custom stat** (Custom stat type None/Users invited → Goal, Label). #1028 reworded the labels to sentence case and several help texts (`ActionForm.tsx:194-209`; `lib/actionFieldDefs.ts:179-278`).
- AD-27 Partitioned suite: a "Partition" section with "Edit the suite's partition" link. It hides prerequisites and participants unless the action still carries them, in which case it shows them with an alert "Clear this action's prerequisites and participants below before saving." (`ActionForm.tsx:211-242`).
- AD-28 Suites still loading or failed: optional work, prerequisites and participants are hidden with a status or alert message (`ActionForm.tsx:231-241`).
- AD-29 **Prerequisites** picker: chips with remove, an "Add prerequisite..." select (excludes self and already chosen), and an empty-state explanation (`components/PrerequisitePicker.tsx`).
- AD-30 **Participating users** cohort expression builder (tags, actions, users, active-contract users, onboarding flag) (`components/CohortExpressionBuilder.tsx`). It is shared with follow-up forms; its leaf editors are not inventoried here.
- AD-31 **Open-reference warnings** under the cohort: conditions reading actions still open at launch (suggest adding them as prerequisites), actions closing at the same deadline, actions closing after this one or with no deadline, and onboarding actions (`components/OpenReferenceWarning.tsx`).
- AD-32 Save button states: "Uploading image..." / "Creating..." / "Saving..." / "Create action" / "Save changes", disabled while saving, uploading or on a cohort parse failure. On new actions there is also **Cancel** (`ActionForm.tsx:289-316`).
- AD-33 Save behaviour: a blank name is refused first (AD-21). Content confirm X-1 over the authored fields (body checked for site links). In a partitioned suite the `optional` flag is omitted and the stored one adopted. The slug is excluded (it saves inline). A successful create or save toasts `Saved "<name>"` (#1028) (`useActionEditor.ts:348-451`).

### Events tab (`components/EventManagementTab.tsx`, `CreateEventForm.tsx`)
- AD-34 "Add new event" (collapsible, open by default):
  - **Status this event sets** select (all 8 statuses; "New Status" before #1028);
  - "Use custom name" (default title from the status, otherwise Event title, required, plus Description (optional));
  - "Launch now" (default) or a DateTimePicker in the local zone;
  - for Member action, "Automatically create deadline event" with a deadline time (default +7 days 23:59 local) and "Transition to" Office action/Completed. Since #1028 a deadline at or before the launch is refused before anything is asked or sent: "The deadline must come after the launch. Pick a later one.";
  - a Member action event asks the typed launch confirm X-8 first (#1028). The button is pending from the question on, so a second submit can't ask again; the launch time is taken when staff confirm, and a scheduled time that passed while the question sat open is refused ("The launch time passed before you confirmed. Pick a new time.");
  - button states Adding event... → Event added (3s). X-4 applies to each event; declining the deadline shows "Added the launch event without its deadline event…". Errors are `role=alert` (`components/CreateEventForm.tsx:128-232`).
- AD-35 "All events" list newest first: title, status pill, description, and localized date with time zone. **No edit or delete for action events here** (only suite events are editable, SU-6) (`components/EventManagementTab.tsx:54-92`).

### Task form tab
- AD-36 Full FormBuilder in task-flow mode for the action's task form. It creates "<action> form" if none, and saving a new form links it to the action (`pages/ActionDashboard.tsx:302-309`; `useActionEditor.ts:198-213`). The builder itself belongs to the Forms inventory.

### Form variants tab (`components/ActionFormVariantsTab.tsx`)
- AD-37 Explanation, **View responses** (to the responses tab), **Add variant** (disabled without a task form; named "Variant B/C…"; default split min(remaining, 50%)), and **Publish drafts (N)** (disabled when nothing is staged or the splits are over 100%).
- AD-38 Staged rows (client-only, with a warning that refreshing discards them): name, % of new joiners, Remove. Publish runs in sequence and stops at the first refusal, keeping the refused draft and those after it; toasts "Published N variants".
- AD-39 Published rows: name and split editable, **Edit form** (`/forms/:formId`), **Save** (only when dirty), and **Delete** (`window.confirm` explaining the before- and after-launch rules).
- AD-40 Coverage table: Group (Default · …), Form (display slug, links to the form), Split or "remainder", Assigned, Submitted, Totals, and a warning when the splits are over 100% (`components/ActionFormVariantCoverage.tsx`).

### Updates tab (`components/ActionUpdatesTab.tsx`)
- AD-41 "Update copy guidelines" link. Create form: **Title**, **Notif text for people who completed**, **Notif text for people who didn't complete** (hint), **Notification audience** (No notification / Action cohort members / All members / Specific tag), **Date**, **Target tag** (when tag), **Associated event (optional)**, and a live **Preview update** (`components/UpdatePreview`).
- AD-42 **Create and write content**: single-flight, disabled only while creating. Changed in #1028: instead of sitting disabled, a click with something missing creates nothing and lists everything missing as one alert: "Add a title.", "Pick a date.", the notification-text problem followed by 'Or set the audience to "No notification".', and "Pick the tag to notify." On success it navigates to the update editor. Refusals are shown inline (`components/ActionUpdatesTab.tsx:71-108,283-296`).
- AD-43 Existing updates via `sharedweb/ui/ActionUpdateCard` (staff view): a Draft badge when not yet visible, an **Edit** link (visible text since #1028, named "Edit <title>" for screen readers), and **Delete** (anchored confirm "Delete "<title>"? Members stop seeing it."). Delete is hidden while in flight, and an already-deleted update counts as deleted (`components/ActionUpdatesTab.tsx:110-134,309-337`).

### Follow-up forms tab (`components/ActionFollowUpFormsTab.tsx`)
- AD-44 Selector of follow-up forms (label via `followUpFormLabel`), **View responses** (`/forms/:formId/responses`), and **Create follow-up form** (creates an empty form "<action> - follow-up" and links it).
- AD-45 Per form: **Name**, **Instructions (markdown)**, **Target cohort** (cohort builder; empty means nobody sees it; parse failure disables save), **Start date** and **End date**, **Save fields**, and **Delete follow-up form** (`window.confirm`). Below that, an embedded FormBuilder for its form.

### Responses tab (`components/ActionMergedResponsesTab.tsx` → `components/FormResponsesView.tsx`)
- AD-46 Merged responses across the default form and every variant (variant-only questions are appended for stats and CSV). Title "<form> — all variants" when variants exist.
- AD-47 All URL state is namespaced `resp_`: `resp_tab` (responses / stats / questions / replays), `resp_variant`, `resp_filterField` / `resp_filterOp` / `resp_filterValue`, `resp_questionField`, and the table's `resp_q` (search), `resp_sort`, `resp_hidden` (columns), `resp_version`, `resp_response` (drawer) (`FormResponsesView.tsx:137-165`; `responses-table/ResponsesTable.tsx:111-355`).
- AD-48 Header: **Refresh** (refetches variants, responses, withdrawals and share links; toast on failure), **variant filter** (only with more than one form), **Reassign snapshots** (goes to `/forms/:id/snapshots` with a returnTo, and a picker when ambiguous), **Export CSV** (`<title>-responses.csv`, BOM, includes variant name), and **Export HTML** report.
- AD-49 Views: table (search, sort, column visibility persisted in localStorage per form, version filter, row expand, response drawer with prev/next), stats (click to filter replays), per-question view, and replay navigator (page through filtered responses, respondent search, clear filter). It marks withdrawn members and names who invited anonymous respondents. Details belong to the Forms inventory.

### Cohort Decisions tab (`components/ActionCohortDecisionsTab.tsx`)
- AD-50 Summary "N assigned, M excluded. Members without a decision are not listed." and a member search (client-side, by name).
- AD-51 Table: Member (link to `/member/:id`, plus correction history lines "Was <decision> (<reason>, <time>). <who>, <time>: <note>"), Decision (Assigned/Excluded), Reason (At launch / On signing / Resolved after deadline / Backfill / Staff correction / After prerequisites), and Resolved time.
- AD-52 **Correct decision** (⇄ with tooltip) → modal "Assign/Exclude <name>?" with a required **Reason**, Cancel, and Assign/Exclude member. Undismissable while pending; the error is shown inline (`components/CohortDecisionCorrectionModal.tsx`).

### Unsaved details (added in #1028)
- AD-53 **Leave guard on Action details** (X-3; `pages/action-dashboard/useActionEditor.ts:53-74,337-346`): leaving the action with unsaved details, or while a cover image is still uploading, prompts. Switching tabs on an existing action keeps the draft and doesn't prompt. On `/actions/new` a change of search params prompts too, because it resets the draft. The navigation a create or save starts itself isn't prompted. Clean and dirty are compared with blank, null and absent fields equal and key order ignored, so adding then removing a prerequisite, or setting a suite back to none, reads as clean.
- AD-54 **A late save leaves the next action alone** (`useActionEditor.ts:166-171,207,224,404,434`): a create, save, task-form link or staff-preview write that resolves after staff moved to another action still toasts, but doesn't touch that action's draft or navigate away from it.

**Data:** `useActionAdmin` (`actionsFindOneAdmin`, `actionsCreateAdmin`, `actionsUpdateAdmin`, `actionsArchiveAdmin`, `actionsUnarchiveAdmin`, `actionsAddEventAdmin`, `actionFormsCreate/Update/DeleteFollowUpFormAdmin`, `actionsPasteJsonAdmin`); `useActionEditorLookups` (`useAllActions` → `useActionsAdmin`, `useTagsAdmin` → `userTagGetTagsAdmin`, `useActionSuitesAdmin` → `actionSuitesSuitesAdmin`, `useSelectableUsers`, `useMembers` for active-contract ids); `useActionReporting` (`actionsShareUrlStatsAdmin` with a hard-coded `questionId`, `analyticsGetActionStatsByIdAdmin`, `actionsGetIncompleteUsersAdmin`, `formResponsesAdminQuery` → `tasksGetFormResponsesAdmin`, `useAdminTaskForm` → `tasksGetFormAdmin`); `actionsExportActionAdmin`; `useCreateFormAdmin` (`tasksCreateFormAdmin`); `useAdminTaskFormActions.fetchLatest`; `useFormVariantsAdmin` (`actionFormsList/Create/Update/DeleteFormVariantAdmin`); `useActionUpdateAdmin` (`actionUpdatesCreate/DeleteUpdateAdmin`); `useActionMergedResponsesAdmin` (`tasksGetFormResponsesByFormsAdmin`, `actionsShareLinksForFormAdmin`, `useFormWithdrawalsAdmin`); `useCohortDecisionsAdmin` (`cohortDecisionsListForActionAdmin`, `cohortDecisionsCorrectAdmin`); `useActionCompletionCurvesAdmin` (`analyticsGetActionCompletionCurvesAdmin`); `useProjectsAdmin` / `useProjectAdmin` (`projectsFindOneAdmin`); `useCoverImage` (`shared/lib/uploadImageDataUri`).
**Shared code:** `sharedweb/ui/{Card,Button,BaseButton,Dropdown,LargeCheckbox,DateTimePicker,UserSelect,UploadingWithCancel,ActionUpdateCard,Modal,Tooltip,InlineError,Spinner,Avatar}`, `sharedweb/lib/clipboard`, `sharedweb/lib/downloadBlob`, `shared/parsed-dtos` (parseActionDto, parseFollowUpFormDto), `common/cohort-expression`, `common/prerequisite`, `common/actionEvent`, `common/forms/*`, `common/url.ensureHttpProtocol`.
**Tests:** `components/ActionForm.test.tsx` (sections, auto-open, staff preview hidden, custom stat and forum visibility, labels and help text), split in #1028 into `ActionForm.editing.test.tsx` (stored values, categories, image states) and `ActionForm.suites.test.tsx` (suites, partition rules); `ActionFormFields.test.tsx` (layout order, linked field ids); `pages/action-dashboard/useActionEditor.test.tsx` (dirty/clean, staff preview kept, grid optional kept, slug excluded, site-link confirm, reviewer and thumbnail links not asked, author bio ignored; since #1028: blank name refused, a new action dirty after one edit, clean after undoing a prerequisite, suite or thumbnail edit, the next action's draft untouched by a late save); `actionEditorLeaveGuard.test.tsx` (AD-53, AD-54); `ActionDashboardToolbar.test.tsx` (Duplicate disabled with its reason while unsaved); `useActionCommands.test.tsx` (duplicate clones the form, keeps Kora task kind, stops on clone or load failure); `lib/useLeaveGuard.test.tsx` and `lib/useConfirmOnPage.test.tsx` (X-3, X-9); `useActionReporting.test.ts` (late responses, public-only stats, incomplete users only when done, banner rules); `actionReadiness.test.ts`; `actionSaveErrors.test.ts`; `ActionReviewersEditor.test.tsx`; `CreateEventForm.test.tsx`; `EventManagementTab.test.tsx`; `ActionFormVariantsTab.test.tsx`; `ActionFormVariantCoverage.test.tsx`; `lib/useFormVariantsAdmin.test.ts`; `ActionUpdatesTab.test.tsx`; `ActionMergedResponsesTab.test.tsx`; `lib/useCohortDecisionsAdmin.test.ts`; `ActionCompletionCurveChart.test.tsx`; `lib/actionFieldDefs.test.ts`; `lib/linkedSelection` (via `ActionFormFields.test.tsx`). There is no page-level `ActionDashboard` test.
**Notes:**
- **Deleting an action: removed in #1028.** It was unreachable before (the Delete button was commented out); now `handleDelete`, `ActionForm`'s `onDelete`, `ActionEditor`'s `onDelete` mode field and `useActionAdmin().removeAction` / `isRemoving` are deleted, so the admin has no code path that calls `actionsRemoveAdmin`. Archive (AD-9) is the only way to retire an action. The redesign must still decide whether delete is a capability.
- The "Users Who Failed to Complete" links point to `/users/:id`, which isn't an admin route (should be `/member/:id`) (`ActionParticipationStats.tsx:141`, still so after #1028).
- Invite stats use a hard-coded question id `field-1765411401186` (`useActionReporting.ts:57`).
- #1028 moved this flow's tab labels, buttons and field labels to sentence case. Left in title case: the "Failed to Complete" stat card (`ActionParticipationStats.tsx:104`), the sidebar's folder and link names (X-7), and the form builder's own tabs and Save button (Forms B1, B8).
- Project controls are duplicated: toolbar (assign/rename/create), overview project card (category/delete/steps), and the project page.
- The missing leave guard for unsaved Details edits was added in #1028 (AD-53).

---

## 7. `/actions/:actionId/updates/:updateId`: action update editor

**New place:** Tasks › All tasks › Task record › Messages, with the update open in the side sheet.
**Purpose:** write an update's content blocks, set its notification copy, audience and date, publish or unpublish it, and send its one-time notification.
**Page:** `pages/ActionUpdatePage.tsx`

**Capabilities**
- AU-1 Tabs `?tab=content` (default, "Content") / `details` ("Update details") (`pages/ActionUpdatePage.tsx:39,50,398-420`).
- AU-2 "← Back to updates" to `/actions/:id?tab=updates`. Errors: "Invalid update id", "Update not found" (404), "Failed to load update", each with Back (`pages/ActionUpdatePage.tsx:182-201,378-385`).
- AU-3 **Hidden-from-members banner**: unpublished ("publishes the first time you save content…") or scheduled ("publishes <time>") (`components/ActionUpdateVisibility.tsx:41-54`).
- AU-4 Content tab: display-only FormBuilder (block editor) saving the schema through `useDisplayOnlySchemaSave` (conflict-aware). Content saved by a newer admin version shows "This update can't be edited here … Refresh" instead of the editor (`pages/ActionUpdatePage.tsx:349-371`).
- AU-5 Details: **Title** (required), plus notification text. Legacy mode has "Short notification text" (auto "Update: " prefix; required unless the audience is none). Recognition mode has two texts (completed / didn't complete). Once copy is frozen it notes "Each member's copy was frozen…" (`pages/ActionUpdatePage.tsx:219-265`).
- AU-6 **Notification audience** (No notification / Action cohort members / All members / Specific tag, plus Target tag). Then:
  - a held banner "This update's notifications are on hold" with the reason;
  - once sent: "Sent <time> to <audience>. An update can only be notified about once.";
  - otherwise **Send notification**. Changed in #1028: it opens a fullscreen confirm "Send notification?" / "This notifies <audience>. It can't be undone, and it can only be sent once." that needs `I am going to notify many real members` typed (X-5), with Send and Cancel; it was a native `window.confirm`. The question closes, sending nothing, if staff go to another update while it is open (X-9) (`pages/ActionUpdatePage.tsx:140-157`). It is disabled with a reason: pick an audience and save, save changes first, write the notification text, or write the body on Content first (`components/ActionUpdateNotificationAudience.tsx`; `lib/actionUpdateDetails.ts:55-75`).
- AU-7 **Date** (DateTimePicker): the displayed date.
- AU-8 **Member visibility**: Scheduled → **Publish now**. Published → **Unpublish until displayed date**, blocked when details are unsaved or the date has passed (`components/ActionUpdateVisibility.tsx:56-143`).
- AU-9 **Associated event** select (or "Couldn't load the action's events.") (`pages/ActionUpdatePage.tsx:298-326`).
- AU-10 **Preview update** with recipient counts per group (completed / didn't complete / uninvolved) for the picked, unsaved audience. Recognition mode only, before copy freezes (`components/AudienceUpdatePreview.tsx`).
- AU-11 **Save changes** with content confirm X-1, then refills from the server response and toasts `Saved "<title>"` (#1028). Error "Failed to save update", shown as `role=alert` (`pages/ActionUpdatePage.tsx:108-125,388-395`).
- AU-12 **Polling**: while `notificationHeldReason` is set the update refetches every 15s (`lib/useActionUpdateAdmin.ts:30,51-52`). A refetch refills the form only if there are no unsaved edits, and a cached copy from an earlier visit is never used to fill the form (`pages/ActionUpdatePage.tsx:84-98`).
- AU-13 **Leave guard on Update details** (added in #1028; X-3; `pages/ActionUpdatePage.tsx:100-103`): leaving with unsaved details prompts; switching between Content and Update details doesn't. Edits already discarded at the prompt aren't asked about again when the next update is slow or fails to load. The Content tab's builder has its own guard (Forms B13).

**Data:** `useActionUpdateAdmin` (`actionUpdatesFindOneUpdateAdmin`, `UpdateUpdate`, `NotifyUpdate`, `PublishUpdateNow`, `UnpublishUpdate`), `useRecognitionPreviewCounts` (`actionUpdatesPreviewUpdateRecognitionCountsAdmin`), `useActionAdmin` (events), `useTagsAdmin`.
**Shared code:** `common/action-update-copy.readGroupResults`, `common/forms/display-only-schema`, `sharedweb/ui/DateTimePicker`, `shared/lib/hey-api.thrownStatus`, `common/run`.
**Tests:** `pages/ActionUpdatePage.test.tsx` (invalid/404/other errors, waits for reload over cache, events picker and failure, notification refusal, legacy versus recognition copy, frozen copy hides preview, preview variations, counts before save, worldalliance confirm, held banner drops once sent, other admin's change shown, unsaved edits kept, save versus poll races; since #1028: nothing sent when the confirm is cancelled, the confirm withdrawn when staff go to another update, save toast, refused save announced as an alert, leave prompt but not for a tab change); `ActionUpdateVisibility.test.tsx`; `ActionUpdateRecognition.test.tsx`; `AudienceUpdatePreview.test.tsx`; `lib/useActionUpdateAdmin.test.ts`.
**Notes:** the same updates also appear on `/action-updates` (Content inventory). The Send confirm was a native `window.confirm` before #1028; it is now the typed confirm (AU-6). While loading or failed the tab title is still "Action Update - Admin" (`pages/ActionUpdatePage.tsx:176,185`).

---

## 8. `/suites/:suiteId`: suite record

**New place:** Tasks › Suites › Suite record (`#/suite/:id`; tabs Timeline, Tasks, Reminders, General updates, Partition, Launch).
**Purpose:** manage a suite's shared events, partition, general updates and reminders, and start its launch.
**Page:** `pages/ActionSuitePage.tsx`

**Capabilities**
- SU-1 A suite with no actions shows its name as the heading, "No actions yet" and **Add new action** (`/actions/new?suiteId=`) (`pages/ActionSuitePage.tsx:85-101`).
- SU-2 Gantt of the suite's actions titled with the suite name, with **reminder overlays**: red lines for point reminders and shaded windows for ranges, with tooltips. Clicking one highlights that reminder card (red border, 2s) and scrolls to it (`pages/ActionSuitePage.tsx:39-55,108-114`; `components/ActionTimeline.tsx:355-433`).
- SU-3 Launch entry: **Begin launch process** → `/suites/:id/launch`. In its place it shows: partitioned → `PARTITION_LAUNCH_REFUSED` text; an existing office-action event → "…Delete it from the suite's events, then launch."; already launched → nothing (`pages/ActionSuitePage.tsx:115-129`; `components/suite-launch/launchBlockers.ts:30-40`).
- SU-4 **Partition section** (feature flag `Features.SuitePartitioning` gates conversion; `pages/ActionSuitePage.tsx:130-136`). Hidden for unpartitioned scheduled suites. Unpartitioned: an explanation, "Partitioning is off in production until partitioned suites can launch." when the flag is off, and **Partition this suite** (anchored confirm "This can't be undone. A partitioned suite can't launch yet.") (`components/suite-partition/SuitePartitionConvert.tsx`).
- SU-5 **Partition editor** (`components/suite-partition/SuitePartitionEditor.tsx`):
  - a "Launch failed" alert;
  - "saved elsewhere" or "an action left this suite" alert with **Load latest** (drops edits);
  - ordered parts, each with name, Condition (formula, e.g. `isOnList("Volunteers")`, monospace), "When the condition is undecided" (Not chosen / put here / continue), "This part intentionally has no required work" tick (only when the part has no required cells), **Move up / Move down** (never past "Everyone else"), and **Remove <part>** (focus goes to Add part);
  - the last part "Everyone else" is fixed;
  - **Add part** (inserted before Everyone else);
  - grid "What each part is given": a Required / Optional / Not assigned select per part × action;
  - **Save partition**, with optimistic version `baseVersionId`. A refusal shows problems at each part (marked diagnostics), and warnings show until edited;
  - **Run preview**: population with an agreement, count per part, required / optional-only / nothing / couldn't decide, errors members hit, and parts no member reached. It is marked out of date after edits;
  - status "Unsaved changes." / "Saved."; leave guard X-3.
- SU-6 **Suite events** row (sorted by date, wrapping): each card shows title, description and date with its time zone, with **Edit for all** (labelled Title, Description and Date fields, the date with a time-zone hint) and **Delete** (overlay confirm "Delete for all suite actions?"). Delete errors add "(events will fail to delete if reminders depend on their existence)"; the error shows as an alert above the events. **Add event** (a bare "+" before #1028; reads "Close" while open) opens CreateEventForm in suite mode (same fields and rules as AD-34; X-4 on add and edit). **Since #1028 a Member action event added here needs the typed launch confirm X-8**, which says every action in the suite opens and that this skips the suite launch checks (`components/SuiteEventList.tsx`, `SuiteEventCard.tsx`; `pages/ActionSuitePage.tsx:66-84,137-147`).
- SU-7 **General updates** card: list (name, start, end; click opens `/general-updates/:id`) and **Create general update** (`/general-updates/new?suiteId=`) (`pages/ActionSuitePage.tsx:148-173`; `components/GeneralUpdateCard.tsx`).
- SU-8 "Actions ordered by priority": ActionListCard per action, sorted by priority descending (`pages/ActionSuitePage.tsx:174-184`).
- SU-9 **Reminders** (`components/reminders/ActionRemindersTab.tsx`), for the suite's first action's member-action events:
  - empty state "No member action events yet…";
  - **New reminder** / Hide form; **Load preset...** (Announcement, Catch-up late joiners, Two day range (24-48h), One day range (6-24h), Three hour, Missed deadline, Group leads 3 days / 2 days, named in sentence case since #1028, `components/reminders/presets.ts:20-29`; dependency-deadline presets are disabled without an upcoming dependency deadline);
  - **Populate default reminders** (only when there are none; typed confirm X-5 outside development; announcement only when there is no deadline event);
  - group cards sorted by send start.
- SU-10 Reminder group form (`components/reminders/ActionReminderGroupForm.tsx`):
  - Member action event select (each option dated with its time zone), Reminder name, Timing mode (Personalized window / Absolute time / Relative to deadline / Relative personalized window / Event launch) with mode fields (send at; hours to deadline; range start and end; window start and end hours before the deadline; "Relative to" dependency-deadline anchor including a stale-anchor warning) (`ReminderScheduleFields.tsx`);
  - Recipients (All uncompleted / User tag / Custom recipients / Group leads with uncompleted members) with a tag select or user picker;
  - Email subject, Email message, Text message and Push message with keyword highlighting, each with Preview (1 task) / (2 tasks) server-rendered previews (`ReminderMessageFields.tsx`);
  - checkboxes Use suite task count, Exclude optional actions, and "Only notify about tasks not yet notified" (not for group leads);
  - collapsible keyword help table (`#{fullname}` … `#{str1|str2}`) (`ReminderKeywordHelp.tsx`);
  - live **tentative plan summary**: "This will send N reminders, starting at …" (warning colour off localhost; "(immediately)" if in the past; Counting recipients… / error with retry). Submit waits for a current count (create only). Create needs typed confirm X-5 with the count; content confirm X-1 runs first.
- SU-11 Reminder card (`ActionReminderCard.tsx`):
  - relative send label, name, schedule description, anchor, "excludes previously notified" note, "All reminders processed", "Sent N reminders <when>" when finished;
  - **Edit** (hidden once finished) / Cancel, and **Delete** (anchored confirm "All planned reminders will no longer be sent.");
  - expanded: missed-suite explanation, stored email/text/push copy plus rendered previews;
  - **Show reminder plans (N)**: member link in a new tab, scheduled time, channels, consecutive miss;
  - **Show sent reminders (N)**: channels, member, time, and delivery status (undelivered text in red).

**Data:** `useActionSuiteAdmin` (`actionSuitesSuiteAdmin`, `AddSuiteEvent`, `BatchUpdateSuiteEvents`, `DeleteSuiteEvent`; results patched into the cache) (`lib/useActionSuiteAdmin.ts`); `useSuitePartition` (`suitePartitionsPartitionAdmin`, `ConvertToPartition`, `SavePartition`, `PreviewPartition`); `useActionReminderGroupsAdmin` (`actionRemindersReminderGroupsForEvent`, `Create/Update/DeleteReminderGroup`, `PlansForGroup`, `SentNotifsForGroup`); `useReminderAnchorCandidatesAdmin`; `useReminderPreviewsAdmin` (`PreviewEmailHtml`, `PreviewTextMessage`); `useReminderTentativePlansAdmin`; `useTagsAdmin`; `useUsersAdmin` (`userListAdmin`).
**Shared code:** `common/features` + `sharedweb/lib/config.isFeatureEnabled`, `common/suite-partition` (`CellAssignment`, `PARTITION_LAUNCH_REFUSED`), `common/expression/undecided-messages`, `components/MarkedDiagnostics`, `sharedweb/ui/{Card,Button,DateTimePicker,LargeCheckbox,UserSelect}`, `components/TextareaWithHighlights`.
**Tests:** `pages/ActionSuitePage.test.tsx` (load failure, delete and edit refusal text, launch round trip, office-event refusal, no launch after launch, parts replace launch, unsaved parts dropped when moving suites); `suite-partition/SuitePartitionSection.test.tsx` and `SuitePartitionConvert.test.tsx` (each editor behaviour above, including edits kept during save, server-normalised adoption, name-only change not offering latest); `components/CreateEventForm.test.tsx` (X-8: nothing sent on cancel, pending while the question is open, no question for other statuses, launch dated from the confirmation, scheduled versus now wording, deadline and passed-time refusals); `reminders/ActionRemindersTab.test.tsx`, `ActionReminderGroupForm.test.tsx` (debounced preview, superseded responses, submit held until count current, retry), `groupSchedule.test.ts`, `reminderGroupDraft.test.ts`, `reminderGroupRequest.test.ts`, `MissedSuiteNote.test.tsx`; `lib/useActionSuiteAdmin.test.tsx`.
**Notes:**
- Reminders use only `suite.actions[0]`'s member events (`ActionRemindersTab.tsx:46,67` has a TODO).
- There is no "add action to suite" once the suite has actions; it can only be done from the action's Suite field.
- The API has no suite rename or delete.
- Suite events and the launch flow both create events; event edits are "for all" suite actions. A Member action event added from the suite events row launches the suite without the launch checklist; since #1028 that path is behind X-8.
- `useReminderGroupClickRatesAdmin` is used only on Stats, not here.

---

## 9. `/suites/:suiteId/launch`: suite launch checklist

**New place:** Tasks › Suites › Suite record › Launch tab.
**Purpose:** a gated pre-flight review that then creates the suite's member-action event, office-action event and default reminders in one go.
**Page:** `pages/SuiteLaunchPage.tsx` → `components/suite-launch/SuiteLaunchPanel.tsx`

**Capabilities**
- SL-1 "Back to suite" (←) and the heading "Launch <suite>" (`SuiteLaunchPanel.tsx:232-243`).
- SL-2 **Progress persisted in localStorage** (`alliance.suiteLaunch.v3.<suiteId>`): picked schedule, ready marks (by review version), dismissals, and accepted violations. Notices say when the browser isn't saving or when saved progress can't be read. It is cleared on launch (`launchProgress.ts`; `SuiteLaunchPanel.tsx:74-131,244-256`).
- SL-3 **Schedule** check: "Members taking action" and "Office taking action" pickers, each with a Pacific label. The default is 7pm PT today if at least 30 min away, else the next whole hour, with office +7 days 23:59. "Members have <duration> to complete their actions". Problems: start in the past, office not after start (`launchSchedule.ts`).
- SL-4 **Reminders** check: the default reminders the launch creates, each with its send window. A "Preview as" selector over member action-mixes. Each reminder expands to email, text and push mockups rendered for a sample member (group-leads variant, missed-deadline variants). It flags reminders reaching members 10pm–8am in their zone, and blocks reminders that would send before members start (`LaunchRemindersCheck.tsx`; `launchReminders.ts`).
- SL-5 **Actions** check: per action, the name, time estimate, optional, member count and cohort description, plus notes (already has its own launch event, edited since marked ready, reading time over the estimate, archived, no members). Unfinished checklist items can be dismissed or restored together, and a dismissal reopens when a new item goes missing. Open-reference warnings use the planned dates. Links: preview action page, edit action, edit task form. A **Ready to launch** checkbox that clears if the action's reviewed content or forms change (`ActionReviewCheck.tsx`; `useSuiteLaunchData.ts:80-109`).
- SL-6 **Preview members' actions**: a table of member groups by exact action set (members, minutes with an over-15-min warning, actions, an eye button that adds a sample member). A Members picker. Per picked member: minutes, **Log in as this member** (`/auth/impersonate/:id`, new tab; with a sign-out warning), per-action task-form and variant preview links (`MemberChecks.tsx`).
- SL-7 **Task forms by member**: for forms with member conditions (including variants with their shares), the member-variant count and a picker that opens the form preview as a member of each profile (`TaskFormPreviews.tsx`).
- SL-8 **Spelling and grammar**: findings (double space, repeated word, punctuation spacing, misspelling via Hunspell plus an Alliance word list, placeholder text, links members can't open) across name, short description, body, task form and variant forms. Context excerpts. Edit links deep-link into the action field selection (AD-7) or the form element. One misspelling is dismissed everywhere at once. Show/Hide dismissed. **Re-run checks** (`TextFindingsCheck.tsx`; `textChecks.ts`; `spellchecker.ts`).
- SL-9 **Contract violations** banner (over 15 minutes per member; under 7 days to complete) with "Launch anyway, breaking the contract". Re-asked if the violations change (`contractViolations.ts`; `ContractViolationsBanner.tsx`).
- SL-10 Blockers list, each linking (smooth scroll) to the section that resolves it (`launchBlockers.ts:103-209`).
- SL-11 **Launch and notify N members**: disabled while blockers exist. Typed confirm X-5 with a Pacific schedule message and a group-leads note. Re-checks the start is in the future. Reloads the suite to refuse if someone launched meanwhile. Creates the member event, office event and reminders, with step-specific failure messages. Success toast "<suite> is scheduled to launch." and back to the suite (`SuiteLaunchPanel.tsx:186-228`; `launchSuite.ts`).
- SL-12 The member count excludes members away during the window, those without an active contract, and (for onboarding actions) those who already signed (`useSuiteLaunchData.ts:170-253`).

**Data:** `useActionSuiteAdmin` (+ `refetchFresh`), `useSuiteLaunchData` (per action `actionAdminQuery`, `adminTaskFormQuery`, `cohortEvaluationQuery` (`actionsEvaluateCohortAdmin`), `useActionsAdmin`, `formVariantsQuery`, `spellcheckerQuery`, `useUsersAdmin`, `useAwayRangesInWindowAdmin` (`userAwayRangeGetAwayRangesInWindowAdmin`)), `useVisibilityProfilesAdmin` (`tasksVisibilityProfilesAdmin`), `useActionReminderGroupsAdmin(null).create`.
**Shared code:** `sharedweb/ui/{Button,DateTimePicker,Card,UserSelect}`, `ToastProvider` (fullscreen, typed), `common/forms/form-schema`, `common/forms/form-conditions`, `components/Disclosure`, `components/SelectableCards`, `components/VisibilityProfilePicker`.
**Tests:** `SuiteLaunchPanel.test.tsx`, `.audience.test.tsx`, `.progress.test.tsx`, `.review.test.tsx`, `launchBlockers.test.ts`, `launchSuite.test.ts`, `launchSchedule.test.ts`, `launchReminders.test.ts`, `launchProgress.test.ts`, `contractViolations.test.ts`, `memberLoad.test.ts`, `textChecks.test.ts`, `spellchecker.test.ts`, `actionTextFindings.test.ts`, `MessageMockups.test.tsx` (email links open in a new tab). All are titled specifically; for example "refuses to launch once the member start has passed while the panel sat open" and "keeps running checks while an action's load is paused offline".
**Notes:** the launch always uses the default reminder presets. There is no per-launch reminder customisation here, which must happen afterwards on the suite page. The partitioned-suite launch is blocked on the suite page, not inside the panel.

---

## 10. `/new-suite`: create suite

**New place:** Tasks › Suites › New suite (Flow).
**Purpose:** name and create an empty suite.
**Page:** `pages/NewActionSuitePage.tsx`

**Capabilities**
- NS-1 Centred card with the heading "Create a new action suite" and a labelled **Suite name** input (autofocus), Cancel (→ `/actions`) and **Create suite** (form submit). Changed in #1028: a blank or spaces-only name is refused on submit with "Give the suite a name." (`role=alert`, the input marked invalid), cleared once a name is typed; before, the empty name went to the server. The server refusal is shown inline, kept while the name is edited and dropped on the next submit. On success it navigates to `/suites/:id` (`pages/NewActionSuitePage.tsx:20-82`).

**Data:** `useActionSuitesAdmin().createSuite` → `actionSuitesCreateSuiteAdmin` (invalidates the suites list).
**Shared code:** `sharedweb/ui/Card`, `Button`, `common/result`.
**Tests:** `pages/NewActionSuitePage.test.tsx` (opens created suite; server reason shown; since #1028: nameless suite not created, missing-name error cleared by typing and kept for spaces, server refusal kept while editing and dropped on a blank submit); `lib/useActionSuitesAdmin.test.ts`.
**Notes:** the empty name that used to reach the server is now refused in the page (NS-1). The only entry point is the Create menu on `/actions`. There is no suites list page anywhere today; suites are reached from action lists, cards and the dashboard's "Open suite".

---

## 11. `/priority`: home-page priority order

**New place:** Tasks › All tasks › Priority view.
**Purpose:** set the order in which actions and general updates appear on members' home pages.
**Page:** `pages/PriorityPage.tsx`

**Capabilities**
- PY-1 One list of actions plus general updates in the home-page order (`homePagePriorityComparator`), with a **divider** "New actions/general updates will be inserted above" placed above the first item with priority below 0 (`pages/PriorityPage.tsx:59-105`).
- PY-2 **Drag to reorder** (HTML5 drag, grip handle, blue before/after insertion bar, dragged row dimmed). The divider is draggable too. No keyboard reordering (`lib/useDragReorder.ts`).
- PY-3 Per row: a movement arrow versus the original (up green, down orange, unchanged), a type chip (Action / General update), name, **home placement badges** (Active task, Active, Onboarding, Available after deadline, Scheduled, Draft, Unscheduled, Staff preview, with tooltips) or "Not on home pages: <reason>", suite name(s), and **View** (→ `/actions/:id` or `/general-updates/:id`) (`pages/PriorityPage.tsx:326-395`; `lib/homePlacement.ts`).
- PY-4 **Show all** checkbox: includes items that can't reach home pages. Toggling drops an unsaved reorder (`pages/PriorityPage.tsx:270-281`).
- PY-5 **Save** ("Save" / "Saving…" / "No changes to save", disabled when unchanged). Priorities = divider index − row index. The saved order is held until both lists reload. Refusals are toasted with the reorder kept (`pages/PriorityPage.tsx:188-245`).
- PY-6 An unsaved reorder survives background refetches and is compared with its own starting order (`pages/PriorityPage.tsx:125-149`).
- PY-7 Explanatory copy: badges mean "can appear", contract-optional tasks sort last, and mobile mixes in general updates while web shows them separately (`pages/PriorityPage.tsx:283-298`).
- PY-8 **Follow-up forms** section (read-only): label, placement badges, parent action link, start – end. Active first, then newest start. Respects Show all (`components/PriorityFollowUps.tsx`).

**Data:** `useActionsAdmin`, `useGeneralUpdatesAdmin` (`generalUpdatesAllGeneralUpdatesAdmin`), `useSetPrioritiesAdmin` (`actionsSetPriorityAdmin`; invalidates both lists after onSuccess).
**Shared code:** `shared/lib/actionUtils.homePagePriorityComparator`, `shared/lib/homePage.compareFollowUpFormsByStartDateDesc`, `common/actionEvent`, `common/followUpForm`, `sharedweb/ui/{Button,ToastProvider}`.
**Tests:** `pages/PriorityPage.test.tsx` (lists, both load failures, refetch error beside list, 401, reorder kept through refetch, compares with starting order, Show all drops reorder, save plus reload, saved order kept when reload fails, refusal keeps reorder, closed-after-deadline listed with reason, follow-ups read-only); `lib/homePlacement.test.ts`; `lib/useSetPrioritiesAdmin.test.ts`; `lib/useDragReorder.test.ts`.
**Notes:** the action form (AD-24) and the general update page both link here as "Manage priority". Drag only, so reordering isn't keyboard-accessible.

---

## 12. `/scheduled`: scheduled automated actions

**New place:** Activity › Scheduled jobs (`#/activity/scheduled`). This is the only route in this group that moves out of Tasks.
**Purpose:** a timeline of upcoming member suspensions and forum-action auto-completions for the next 7 days.
**Page:** `pages/ScheduledPlansPage.tsx`

**Capabilities**
- SC-1 Header "Scheduled plans" / "Timeline of future automated actions" (`pages/ScheduledPlansPage.tsx:80-83`).
- SC-2 Items merged from suspension plans and forum auto-complete plans, sorted by date (`pages/ScheduledPlansPage.tsx:18-41`).
- SC-3 Each item, collapsed: the day in Pacific ("Monday, March 3"), a kind chip (Suspension / Forum action auto-complete), "Auto-complete for <action>" linking to `/actions/:id` (forum only), the ISO UTC timestamp, and "N users scheduled" (`pages/ScheduledPlansPage.tsx:118-164`).
- SC-4 Expand/collapse per item (`aria-expanded`) to show a 2-column grid of users (avatar, display name, link to `/member/:id`) (`pages/ScheduledPlansPage.tsx:166-186`).
- SC-5 States: spinner "Loading scheduled plans...", error (refusal or session text), "No planned automated actions in this window.", and the loaded timeline kept beside an error.

**Data:** `useScheduledPlansAdmin` → `actionsScheduledPlansAdmin` with `rangeStart=now`, `rangeEnd=now+7d`. No polling (`lib/useScheduledPlansAdmin.ts`).
**Shared code:** `sharedweb/ui/{Avatar,Card,CenterLayout,Spinner}`, `common/plural.withCount`.
**Tests:** `pages/ScheduledPlansPage.test.tsx` (lists plans, failure versus empty, timeline kept beside error); `lib/useScheduledPlansAdmin.test.ts` (requests the coming week).
**Notes:** `timeLabel` is computed but never shown, so the time of day is visible only via the UTC string (`pages/ScheduledPlansPage.tsx:68-74,113`). The window is fixed at 7 days, with no control.

---

## 13. `/contracts`: contracts list

**New place:** Tasks › Contracts › Contracts list (`#/tasks/contracts`).
**Purpose:** list member contract versions grouped into active, scheduled and inactive.
**Page:** `pages/ContractsPage.tsx`

**Capabilities**
- CL-1 Header "Contracts", **New Contract** (→ `/contracts/new`), and "N total contract(s)" (`pages/ContractsPage.tsx:73-85`).
- CL-2 Groups with ruled headings: **Active** (the id returned by the current-contract endpoint), **Scheduled** (start in the future, soonest first), **Inactive** (everything else). Empty groups are hidden (`pages/ContractsPage.tsx:27-68`).
- CL-3 Contract row (`components/ContractCard.tsx`): name or "Contract #id", the first 80 characters of the markdown (2-line clamp), Start, End and Created datetimes. The row opens `/contracts/:id`.
- CL-4 States: "Loading contracts...", error only when there's no data, the error kept beside data, "No contracts found.".

**Data:** `useContractsAdmin` → `contractAllAdmin`; `useCurrentContract` (`shared/lib/useCurrentContract.ts` → `contractGetCurrent`).
**Shared code:** `sharedweb/ui/Button`, `common/plural.forCount`, `shared/lib/hey-api.thrownRefusalMessage`.
**Tests:** `pages/ContractsPage.test.tsx` (grouping around current, failure, 401, refetch error kept); `lib/useContractsAdmin.test.ts`.
**Notes:** "Active" comes from the member-facing current-contract endpoint, not from the admin DTO.

---

## 14. `/contracts/:id` (and `/contracts/new`): contract record

**New place:** Tasks › Contracts › Contract record.
**Purpose:** create a contract version, or edit an existing one's name, description points and dates.
**Page:** `pages/ContractPage.tsx`

**Capabilities**
- CR-1 Title "Create contract" / name / "Contract #id". "← Back to Contracts". Errors "Contract not found" (404) / "Failed to load contract" with Back (`pages/ContractPage.tsx:149-195`).
- CR-2 **Name** (placeholder "Contract #id") (`pages/ContractPage.tsx:210-227`).
- CR-3 **Content** markdown: editable only on create (required, monospace, auto-growing) with a live "Preview:". On existing contracts it is **read-only**, rendered via AppMarkdownWrapper (`pages/ContractPage.tsx:228-255`).
- CR-4 **Description** points: **Add point** (+). Each point has Point (markdown), Subtext (markdown), **Admin notes** (amber, "only visible in the admin panel"), **Remove point** (X), and a live rendered preview. Points with an empty Point are dropped on save (`pages/ContractPage.tsx:256-377,50-57`).
- CR-5 **Start date** and **End date** (`datetime-local`, local zone), each with a **Clear** button (`pages/ContractPage.tsx:378-449`).
- CR-6 Cancel (→ list) and **Create contract** / **Save changes** (Creating…/Saving…, disabled while saving). Content confirm X-1. Create navigates to the new id; update toasts "Contract updated successfully"; failure shows "Failed to save contract" and keeps the form (`pages/ContractPage.tsx:101-147,453-475`).
- CR-7 A reload of the same contract doesn't overwrite unsaved edits; the form refills only for a different id (`pages/ContractPage.tsx:96-99`).

**Data:** `useContractAdmin` → `contractFindOneAdmin`, `contractCreateAdmin`, `contractUpdateAdmin` (caches the saved copy and invalidates the list) (`lib/useContractAdmin.ts`).
**Shared code:** `sharedweb/ui/AppMarkdownWrapper`, `sharedweb/ui/DateTimePicker` (`formatLocalDateTime`, `resolveDateValue`), `ToastProvider`, `components/FormTextarea`.
**Tests:** `pages/ContractPage.test.tsx` (list refresh after create and update, fill, unsaved kept on reload, title, 404, load fail, save fail keeps form, admin notes round trip, worldalliance confirm on name and on content links); `lib/useContractAdmin.test.ts`.
**Notes:** there is no delete, and contract markdown is immutable after creation (`UpdateContractDto` has no `markdown`). There is no leave guard.

---

## 15. `/formulas`: formulas list

**New place:** Tasks › Formulas › Formulas list (`#/tasks/formulas`).
**Purpose:** list named reusable conditions and values, and how widely each is used.
**Page:** `pages/FormulasPage.tsx`

**Capabilities**
- FL-1 Header plus the explanation "…A change that would break a formula reading this one is refused until you fix both." and **New formula** (→ `/formulas/new`) (`pages/FormulasPage.tsx:17-29`).
- FL-2 Table columns: **Name** (monospace link), **Formula** (truncated text), **Used by** (count of formulas whose `reads` include it), **Last saved** (datetime) (`pages/FormulasPage.tsx:44-78`).
- FL-3 States: "Loading formulas…" (status), refusal message (alert), "No formulas yet. Create one…".

**Data:** `useFormulasAdmin` → `formulasListAdmin`.
**Shared code:** `shared/lib/dateFormatters.formatDateTime`, `sharedweb/ui/Button`.
**Tests:** `pages/FormulasPage.test.tsx` (used-by counts, empty state).
**Notes:** no search or sort, in list order. "Used by" counts only formulas, not partition parts or other rules that read it.

---

## 16. `/formulas/:formulaId` (and `/formulas/new`): formula editor

**New place:** Tasks › Formulas › Formula record (editor).
**Purpose:** create, edit or delete a formula with dependency-safe saves that can fix broken dependents (formulas and suite partition parts) in the same save.
**Page:** `pages/FormulaPage.tsx`

**Capabilities**
- FE-1 "Formulas" breadcrumb link and heading (name or "New formula"). An unknown id shows "This formula doesn't exist, or was deleted." with a back link (`pages/FormulaPage.tsx:179-190,261-268`).
- FE-2 Fields: **Name** (monospace, max 100), **Formula** (TypeScript expression, max 20000; help mentions `isMissing(x)`, `isOnList("List name")` and links to `/member-lists`), **Notes** (optional, max 5000). Problems are shown inline with marked diagnostics and `aria-invalid` (`components/formulas/FormulaFields.tsx`).
- FE-3 **Save** (form submit). A refused save lists problems: "Nothing was saved. Fix the problems below, then save again." Problems in other formulas or partition parts appear under "Problems in other formulas and parts", each with a new-tab link and **Fix it in this save**, which opens their fields inline with the names this save gives. **Stop fixing it** removes a fix (`pages/FormulaPage.tsx:201-309`; `components/formulas/FormulaFixes.tsx`, `OtherFormulaProblems.tsx`, `PartFixFields.tsx`).
- FE-4 A part fix edits a partition part's Condition and Undecided fallback (suite and part named, linking to `/suites/:id`) (`components/formulas/PartFixFields.tsx`).
- FE-5 Optimistic concurrency: a 409 or a save that lost its answer shows **Reload** (new formula: reload to its page if stored, else to `/formulas/new`) (`components/formulas/SaveRefusal.tsx`; `pages/FormulaPage.tsx:170-177,247-253`).
- FE-6 After a save the fields stay read-only until the editor remounts on the fresh list. Focus returns to Save. A new formula navigates to its page. "Saved, but couldn't load it again. Reload to see it." on reload failure (`pages/FormulaPage.tsx:212-246`).
- FE-7 **Delete formula** (existing only) → destructive ConfirmDialog: readers present ("N formulas read it, so the delete is refused unless the same save fixes what reads it") or not ("…its name is free to reuse"); saved versions are kept. A refused delete shows "Nothing was deleted…". Success toasts "Deleted <name>." and returns to the list (`pages/FormulaPage.tsx:323-367`).
- FE-8 **Uses** and **Used by** link lists (`pages/FormulaPage.tsx:338-351`).
- FE-9 **History** disclosure: loads on open, newest first. Each version shows time, "by <who>", the name, the text, and notes (`components/formulas/FormulaHistory.tsx`).
- FE-10 Leave guard X-3 while there are unsaved edits (primary, fixes or part fixes), bypassed for the page's own post-save navigation (`pages/FormulaPage.tsx:164-167`).
- FE-11 The editor opens only once its own fetch succeeds (never on a cached list); a background refetch never overwrites edits (`pages/FormulaPage.tsx:58-92`).

**Data:** `useFormulasAdmin` (`formulasListAdmin`), `useSaveFormulasAdmin` (`formulasSaveAdmin`; invalidates `suitePartitionsAdminAll` on success), `useFormulaVersionsAdmin` (`formulasVersionsAdmin`), `useForgetFormulaAdmin`, `useInvalidateFormulasAdmin`.
**Shared code:** `sharedweb/ui/{Button,ToastProvider,NewTabMark}`, `es-toolkit.isEqual`, `common/result`, `components/MarkedDiagnostics`, `suite-partition/FallbackSelect`.
**Tests:** `pages/FormulaPage.test.tsx` and `FormulaPage.saveOutcomes.test.tsx` (harness `FormulaPage.testHarness.tsx`); `components/formulas/FormulaFixes.test.tsx`; `FormulaHistory.test.tsx`. These assert focus return, read-only during reload, staying on the page the admin navigated to, leaving without a prompt after a failed reload, and links to newer formulas.
**Notes:** the formula language is shared with suite partition conditions (SU-5). Fixing parts from here edits suite partitions without visiting the suite.

---

## Summary

All 16 routes are covered (plus the `/actions/new`, `/contracts/new` and `/formulas/new` variants), with about 230 capability bullets (PR 13, PD 10, PA 11, AL 10, TL 2, AD 54, AU 13, SU 11, SL 12, NS 1, PY 8, SC 5, CL 4, CR 7, FL 3, FE 11, plus 10 cross-cutting). The refresh at ff886c540b added X-8, X-9, X-10, PA-11, AL-9, AL-10, AD-53, AD-54 and AU-13, and removed no ID. Many bullets bundle several fields, so the testable items run to several hundred.

What a redesign is most likely to lose:
- the safety rails: typed "notify real members" confirms (now also on an update's Send notification), the typed "launch to real members" confirm on every Member action event (X-8), confirms that withdraw when staff move to another record (X-9), deadline-shortening 409 confirms, the content (site-link and worldalliance) confirm, the leave guards on action details, update details, formulas and partitions (X-3), Duplicate held back while details are unsaved, optimistic version checks with Load latest or Reload, and "keep unsaved edits through refetch";
- the suite launch's localStorage-persisted progress and its fine-grained dismiss and restore rules;
- reminder overlays on the suite Gantt and the click-to-highlight link to reminder cards;
- URL state on `/actions`: `?status=` and `?archived=1` (AL-2, AL-9), which Back and shared links rely on;
- deep links between pages: the `?tab=details&field=…` text selection from launch findings, the `resp_*` namespaced response filters jumped to from overview stats, and `#release` / `#details` anchors from the project page;
- low-traffic tools tucked into tabs: Paste JSON, Export JSON, Duplicate, cohort decision corrections, A/B variant staging, follow-up forms, and the read-only follow-ups list on Priority;
- the 15s polling of held update notifications.

Gaps the owner should know about before redesigning:
- deleting an action has no client code at all since #1028 (it was unreachable before);
- `/timeline` is an unlinked stub;
- there is no suites list, and no suite rename or delete;
- a broken `/users/:id` link on the overview;
- contract content is immutable after creation;
- action events can't be edited or deleted outside suites.
