---
user: Alex Dorey
task: Make it easy to create an action from a project's admin page, get it to staff testing, and schedule its release
---

## User-origin requirements

- An admin can go from a project's admin page (e.g. `/projects/28`) to a new action in staff testing with no detours. From staff testing, scheduling the release is equally easy. Today's flow takes too many steps: create the action elsewhere, create a suite, find the draft again, schedule on the suite page, then tick Staff Preview.
- A new admin page at `/projects/:projectId/action/:actionId` (e.g. `/projects/28/action/169`) is where an action in a project moves through its phases.
- A new action's cohort expression is a copy of the previous project step's cohort expression.
- The schedule panel's launch defaults to the next upcoming Tuesday at 6:00 PM Pacific (America/Los_Angeles). On a Tuesday before 6 PM, that is the same day.
- The schedule panel's deadline defaults to 11:59 PM Pacific on the Tuesday after launch.

## Agent-proposed, user-approved

### Phases

- An action in a project is in one of these phases:
  - **Draft:** Staff Preview off, no Members-taking-action event.
  - **Staff testing:** Staff Preview on, no Members-taking-action event.
  - **Scheduled:** a Members-taking-action event in the future.
  - **Live:** that event has passed.
- After its deadline passes, an action shows the project page's existing lifecycle labels (wrapping up, completed, …).

### Project page

- "+ New action" sits next to the existing "Add action" select and opens a quick-create dialog.
- Each step shows a phase pill and its next-step button inline: "Start staff testing" in Draft, "Schedule release" in Staff testing. The step name links to `/projects/:projectId/action/:actionId`.

### Quick-create dialog

- It asks for name and short description only.
- One server call creates, all or nothing:
  - the action, in this project, in Draft;
  - a suite of its own, named after the action;
  - a blank task form named after the action, linked as its task form;
  - its cohort expression, copied from the previous step. The previous step is the project step with the latest launch, with unscheduled drafts last (newest first). In a project with no steps the cohort is Tag = Staff.
- If any part fails, nothing is created and the dialog shows the error.
- On success the admin lands on the action's new page.

### Action's project page (`/projects/:projectId/action/:actionId`)

- From top to bottom:
  1. a phase header with the next-step button;
  2. the readiness checklist;
  3. the action details form and the task form editor;
  4. the schedule panel.
- Reaching Scheduled never requires leaving the page. It links to the existing `/actions/:id` dashboard for everything else (responses, variants, follow-ups, …).
- The details and task form editors save with a Save button, as on today's dashboard. Phase buttons are disabled while either editor has unsaved changes.
- Every action that belongs to a project uses this page:
  - project page links go here;
  - `/actions/:id` links here when the action has a project;
  - a URL with the wrong `projectId` redirects to the action's actual project.
- When an action's suite contains only that action, renaming the action renames the suite.
- Rarely used settings move out of the details form's Settings section into collapsed groups by topic: Audience (Onboarding, Public Only), Completion (Optional, Complete After Deadline, Prevent Completion), Forum participation, Custom stat. This applies here and on `/actions/:id`. A group opens by itself when one of its fields is set.
- A new action starts in Draft, with Staff Preview off.

### Staff testing

- "Start staff testing" turns Staff Preview on.
- It is blocked until short description, body, task form and cohort expression are set. Each missing item links to where it's fixed. The other checklist items (suite, authors, time estimate, reading time) stay advisory.
- "Stop staff testing" turns Staff Preview off and returns the action to Draft. It has no gate.

### Schedule release panel

- It sets:
  - **launch:** creates the Members-taking-action event;
  - **deadline:** its transition is a select defaulting to Office Action;
  - **default reminders:** checked by default.
- The panel shows the reach as "Notify N members on <launch date and time>".
- A single confirm requires typing "I am going to notify many real members". This replaces the separate confirm that "Populate default reminders" has today.
- One server call creates the launch event, the deadline event and the reminders, all or nothing. If it fails, nothing is created and the panel shows the error.
- Staff Preview stays on until launch, when it ends by itself.
- If the action's suite contains other actions, the panel is disabled. It explains that the suite is shared and links to `/suites/:id`.
- Before launch the admin can:
  - change the launch and deadline dates; reminders follow the events they're anchored to;
  - "Unschedule", which deletes the launch event, the deadline event and their reminders and returns the action to Staff testing.
- After launch, the launch date is locked. The deadline can still be changed until it passes.

### Suites and suspension

- An action's own suite counts like any other suite for missed-suite streaks, agreement suspension and the "Missed deadline message" reminder.

### Implementation constraints

- `server/src/actions/actions.service.ts` is not split for this change. It only gains the optional transaction (`EntityManager`) parameters the workflow needs. New logic goes in new files.
- The actions timeline's links keep pointing at `/actions/:id` for now.

### Out of scope

- The other creation paths keep working unchanged:
  - New Action from the + menu on `/actions`;
  - "Add new action" on a suite page;
  - Paste JSON;
  - the `/actions/:id` dashboard.
- No changes to the member apps (frontend, mobile).
