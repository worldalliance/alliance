# Today's journey: creating tasks and a suite, and launching it

Derived from code on `modern-admin` at ff886c540b (`origin/main` after PR #1028, which added typed confirmations and leave guards to this flow; the branch was rebased onto it from c722280863), and from `docs/provenance/01a1812f-9204-7000-9d4f-efb13a967392-suite-launch-flow/REQUIREMENTS.md`.

## How visibility works (server)
- A task's status is the status of its latest event dated at or before now; with no such event it is Draft (`server/src/actions/entities/action.entity.ts:74`).
- Members can't see a Draft task; once any event's date has passed, they can (subject to visibility mode and cohort) (`server/src/actions/action-visibility.service.ts:48-80`).
- An event added to a suite is added to every task in the suite (`server/src/actions/action-suites.service.ts:45-64`).
- So creating any dated event is what exposes tasks to members. Everything before launch must create none.
- The suite page still lets staff add an event to every task outside the launch: "Add event" opens the same form the task's Events tab uses. Since #1028 a Members taking action event asks for the typed phrase "launch to real members" and warns "This skips the suite launch checks." (`apps/admin/src/components/SuiteEventList.tsx:47-66`, `CreateEventForm.tsx:147-160`). Any other status, and "Edit for all" on an existing suite event, still writes with no confirmation (`SuiteEventCard.tsx:32-35`), so a date moved into the past launches at once (ALL-2328).

## The journey
1. **Create the suite**: a name only, which must not be blank (`apps/admin/src/pages/NewActionSuitePage.tsx:20-35`). No dates, no events.
2. **Add tasks**: from the empty suite page, "Add new action" opens `/actions/new?suiteId=` (`ActionSuitePage.tsx:85-101`); each task needs only a name to be created, and is built (details, form, variants, follow-ups, checklist) while Draft. Since #1028, leaving a task's details with unsaved edits asks first (`pages/action-dashboard/useActionEditor.ts:337-346`).
3. **Suite page**: timeline of its tasks, suite events list, partitioning (behind a feature flag), general updates, tasks by priority (`ActionSuitePage.tsx`).
4. **Begin launch process**: a separate page `/suites/:id/launch` that keeps progress across a refresh (`SuiteLaunchPanel.tsx`, `launchProgress`). It pre-fills members taking action at 7pm Pacific today (or the next whole hour at least 30 minutes away) and office taking action, members' deadline, 7 days later at 11:59pm.
5. **Checks** (`launchBlockers.ts` and siblings): member contract violations called out loudly; schedule; default reminders with their actual text; each task's readiness checklist (including "Part of a project") with a "Ready to launch" checkbox and preview/edit links; members whose assigned tasks exceed 15 minutes; preview of the tasks a chosen member gets, with the distribution of task combinations; text findings (spelling, double spaces) that must each be fixed or dismissed. Blockers prevent launching. A partitioned suite or one that already has a members taking action or office taking action event refuses to launch.
6. **Launch**: typed confirmation ("I am going to notify {n} real members"), then, in order: re-read the suite to check nobody launched it meanwhile; create the members taking action event; create the office taking action event; create the default reminders on the member event (`launchSuite.ts`). Each failure says what was and wasn't created.

## Phase order
Draft → members taking action (members start) → office taking action (members' deadline; staff act) → resolution/completed. Office action comes after member action.

## What a suite is
One launch: all its tasks share the suite's members taking action start and office taking action deadline (the suite's events are applied to every task); other events, such as reminders and per-task events, differ per task. A suite is not a multi-week recurring schedule.

## Not derivable from code
- The order staff actually work in (whether tasks are created first and added to a suite later, when partitioning happens, who reviews before launch).
- How tasks outside any suite are launched in practice (the per-task events list exists, with #1028's typed confirm on a Members taking action event). `STAGING-CHECK.md` §1 and §8 answer this from staging data.
