# Today's journey: creating tasks and a suite, and launching it

Derived from code on `modern-admin` at c722280863, before PR #1028 (which adds typed confirmations and leave guards to this flow), and from `docs/provenance/01a1812f-9204-7000-9d4f-efb13a967392-suite-launch-flow/REQUIREMENTS.md`.

## How visibility works (server)
- A task's status is the status of its latest event dated at or before now; with no such event it is Draft (`server/src/actions/entities/action.entity.ts:74`).
- Members can't see a Draft task; once any event's date has passed, they can (subject to visibility mode and cohort) (`server/src/actions/action-visibility.service.ts:48-80`).
- An event added to a suite is added to every task in the suite (`server/src/actions/action-suites.service.ts:45-64`).
- So creating any dated event is what exposes tasks to members. Everything before launch must create none.

## The journey
1. **Create the suite**: a name only (`apps/admin/src/pages/NewActionSuitePage.tsx`). No dates, no events.
2. **Add tasks**: from the empty suite page, "Add new action" opens `/actions/new?suiteId=` (`ActionSuitePage.tsx`); each task is built (details, form, variants, follow-ups, checklist) while Draft.
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
- How tasks outside any suite are launched in practice (the per-task events list exists; #1028 adds a typed confirm there).
