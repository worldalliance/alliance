# Staging check: how tasks and suites are really created and launched

Checked on 2026-11-24 against a staging dump loaded into this worktree's local database (`alliance_modern_admin`) and the code at c722280863. Aggregates only; no names, ids or message text.

**Labels.** "Data" = counted in the loaded dump. "Code" = read in the source at the cited line. "Judgement" = my inference, not something a row or a line states.

## How the data was loaded, how fresh it is, how real it is

- **Load.** `DUMP_DIR=.scratch/greenfield/staging ./scripts/load_staging_data.sh` (the documented path: `pg_dump` over the `staging` SSH alias, then drop, recreate and restore the local database, then clear push tokens). Exit 0. Nothing else touched staging; production was not touched. Log: `staging/load.log`.
- **What staging is (code/docs).** A nightly anonymised copy of production: `scripts/sync_prod_to_staging.sh` runs at 10:30 UTC daily (`deploy/systemd/alliance-prod-to-staging-sync.timer`, `docs/legacy/monitoring.md`). The anonymiser rewrites users, phone numbers, mail and form answers; it does not touch tasks, events, suites, projects, form schemas or reminder groups. So these counts are production's, plus whatever staff did on staging between the sync and the dump.
- **Freshness (data).** Dump taken 2026-11-25 06:06 UTC. Latest task created 2026-11-24, latest event write 2026-11-24, latest member response 2026-11-23.
- **Size (data).** 124 tasks created 2025-08 to 2026-11 (4 to 12 a month), 246 events, 73 suites, 19 projects, 143 forms, 2,943 form snapshots, 367 reminder groups, 21,029 reminder notifications, 774 users (8 admin), 8,503 form responses. No soft-deleted tasks, events, suites or reminder groups.
- **Staging-side rows (judgement).** I could not confirm the sync ran on 2026-11-24 without querying staging, which was out of bounds. If it ran on schedule, rows written after 10:30 UTC that day are staging-only: 4 tasks (all archived drafts with no events; 2 of them a pasted pair) and 2 events on one task (a member-action and a deadline event added from the task's Events tab). They are flagged below wherever they change a number.
- **Limits that apply throughout.**
  - Events carry `updatedAt` but no `createdAt`, and zero events are soft-deleted, so an event that was deleted or re-dated in the past leaves no trace. "First event" and "date versus write time" describe the rows as they stand now.
  - Form version history begins 2026-04-28 (earliest snapshot). Form answers are only reliable for tasks launched from May 2026 on.
  - 124 tasks is the whole population, so any split under about 10 rows is noted as small.

SQL files are in `.scratch/greenfield/staging/` (`q0.sql` … `q9.sql`, outputs in `*.out`); `q.sh` runs them and refuses any database but this worktree's. Every query defines "launched" as: has a `member_action` event dated at or before the dump.

---

## 1. How tasks get launched

**Data** (`q1.sql`, `q1b.sql`, `q2.sql`).

| | Tasks |
|---|---|
| All tasks | 124 |
| With any event | 105 |
| With a member-action event (all dated in the past) | 105 |
| Launched, in a suite | 102 |
| Launched, no suite | 3 |
| Never launched (drafts) | 19 |

Every task that has any event has a member-action event. None is scheduled for the future.

For the 102 launched tasks in a suite:

| How the member-action event got there | Tasks | Suites |
|---|---|---|
| Suite-wide: `suiteManaged`, same date as every other launched task in the suite (suites of 2+) | 52 | 22 |
| `suiteManaged` on a suite holding one task (suite page event, suite launch panel or project Schedule release; the rows look the same) | 36 | 36 |
| `suiteManaged`, but a different date from its suite-mates | 1 | 1 |
| Individually from the task's Events tab (`suiteManaged = false`) | 13 | 6 |

- Of the 13 individual ones, 10 are dated 2025-08 to 2025-10, before suites existed (the suite model merged 2025-11-02; those tasks were put in suites afterwards). Since then: 2 in production (2026-02, 2026-06) and 1 on 2026-11-24 that is probably a staging-side test (see above). **Small numbers.**
- 38 of the 64 launched suites hold exactly one task; 23 hold 2–3; 3 hold 4 or more. A suite is, more often than not, a wrapper around a single task.
- 60 of 64 launched suites have one launch date; 3 have two; 1 has six (a 2025 suite assembled from tasks launched separately).
- Timing of the 89 `suiteManaged` launch events, date against last write: 39 dated at the write time ("now"), 46 scheduled less than a day ahead, 4 a day or more ahead. Of the 16 Events-tab ones, 8 are "now" and 8 are dated more than a day before their last write (back-dated or edited later). 48 of 105 launches are at 19:00 Pacific; 93 of 101 member windows last 6–8 days.

**Schedule release (code, then data).** `scheduleRelease` (`server/src/actions/project-actions.service.ts:142-192`) writes a `member_action` event with `suiteManaged: true`, optionally a deadline event (also `suiteManaged`), and reminder groups with the suite's id, on a task that is alone in its suite, with a launch date the server requires to be in the future. Nothing marks the event as coming from this flow; a suite-page event on a one-task suite writes the same rows. The distinguishing context is the task being in a project, alone in a suite **named after the task** (what project "New action" creates, `:96`), with staff preview on.
- **One task matches all of it**: created and launched 2026-11-17, suite named after the task, staff preview on, member and deadline events both `suiteManaged`, launch dated after the write, 7 reminder groups (the default set with a deadline). The flow merged 2026-11-09 (git log). So: used once, in production data, about a week after it shipped. **Rests on one row.**
- That is also the only task ever created through project "New action" (the only suite named after its sole task).

**Projects (data).** 44 of 124 tasks have a project. All 19 projects were created 2026-09 or later (14 in 2026-09, 2 in 2026-10, 3 in 2026-11); the project model merged 2026-09-23 (git log). Tasks created as far back as 2025-11 carry a project, so older tasks were assigned retroactively. Every project has at least one task. All 44 have launched; 28 of them launched before 2026-09, i.e. before projects existed.

```sql
-- launched tasks by suite, and suite-wide versus individual
with l as (select a.id, a."suiteId", e.date ma_date, e."suiteManaged"
           from action a join action_event e on e."actionId"=a.id
           where e."newStatus"='member_action' and e.date<=now() and a."suiteId" is not null),
 g as (select l.*, count(*) over (partition by "suiteId") n_in_suite,
              count(*) over (partition by "suiteId", ma_date) n_same_date from l)
select case when n_in_suite=1 then 'only launched task in its suite'
            when n_same_date=n_in_suite then 'same date as every launched task in suite'
            when n_same_date>1 then 'same date as some' else 'own date' end pattern,
       "suiteManaged", count(*) tasks, count(distinct "suiteId") suites
from g group by 1,2;
```

## 2. Which event statuses are used

**Data** (`q2.sql`).

| `newStatus` | Events | Tasks | 2025 | 2026 | First event on a task (by date and by row id) |
|---|---|---|---|---|---|
| member_action | 105 | 105 | 23 | 82 | 104 |
| office_action | 79 | 79 | 12 | 67 | 0 |
| completed | 61 | 61 | 15 | 46 | 0 |
| planned | 1 | 1 | 1 | 0 | 1 |
| resolution, failed, abandoned, draft | 0 | 0 | 0 | 0 | 0 |

- **Planned was the first event on one task, in 2025**, dated before that task's member-action event. That is the one recorded case of a non-member event taking a draft live. **One row.**
- **Abandoned, Failed and Resolution have never been used.** No surviving row, in 16 months.
- **Completed and Office action were never added to a task without a member-action event**, and never dated before it. No task has events but no member-action event.
- Event sequences per task: member → office (40), member → office → completed (38), member → completed (22), member only (4), planned → member → office → completed (1).
- Titles are the defaults except 23 office-action events titled "Pending office action" (an older default, judgement).
- Status at the dump: completed 61, office_action 38, member_action 6, draft 19 (16 of them archived).

Caveat: deleted events leave no row, so "never" means "no surviving row".

```sql
with r as (select e.*, row_number() over (partition by "actionId" order by date, id) by_date,
                  row_number() over (partition by "actionId" order by id) by_id from action_event e)
select "newStatus", count(*) filter (where by_date=1) first_by_date,
       count(*) filter (where by_id=1) first_written from r group by 1;
select e."newStatus", count(*) from action_event e
where not exists (select 1 from action_event m where m."actionId"=e."actionId" and m."newStatus"='member_action')
group by 1;   -- 0 rows
```

## 3. Public-only

**Data** (`q34.sql`). 4 of 124 tasks have `publicOnly` set. At the dump: **1 is a draft (not archived), 0 are archived**, 3 are completed. All 4 are Public visibility and none is in a suite; 2 of the 3 launched ones have no cohort at all. The 3 launched public-only tasks are exactly the 3 launched standalone tasks (question 8). **Four rows.**

So the "public-only draft opens to anyone with the id" exposure exists for exactly one task today.

```sql
select status, archived, count(*) from st where "publicOnly" group by 1,2;  -- st: task + status at dump, see q34.sql
```

## 4. Visibility default

### Code

**The claim is right about visibility and incomplete about assignment.**

- **Entity column default: Public.** `@Column({ type: "enum", enum: VisibilityMode, default: VisibilityMode.Public })` (`server/src/actions/entities/action.entity.ts:236-243`). The database column agrees: `'public'::action_visibilitymode_enum`.
- **DTO: no default; the field is required.** `CreateActionDto` picks `visibilityMode` from `ActionDto` in the non-partial group (`server/src/actions/dto/action.dto.ts:245-258`), and the property is `@IsDefined()`. An API caller must send it. The column default only applies to inserts that bypass the DTO (Paste JSON of an export that lacks the field).
- **What each creation path sends:**

| Path | `visibilityMode` | Cohort | Where |
|---|---|---|---|
| `/actions/new` | `"public"` | none (null) | `emptyActionDraft`, `apps/admin/src/pages/action-dashboard/useActionEditor.ts:24-45` |
| From a suite (`/actions/new?suiteId=`) | `"public"` | none | same function, with `suiteId` |
| From a project ("New action") | `VisibilityMode.Public`, set on the server | copied from the previous project step, else `{type: "Staff"}` | `server/src/actions/project-actions.service.ts:85-125` |
| Duplicate | whatever the source task's editor state holds | the source's | `useActionCommands.ts:58-111` (as CUJ-TASK says; I did not re-read it) |
| Paste JSON | whatever the JSON holds, inserted as-is | the JSON's, re-validated | `server/src/actions/action-import-export.service.ts:95-133` |

  The Details select lists All Members first, then Participating Groups, then Public (`apps/admin/src/lib/actionFieldDefs.ts:55-59`), but the pre-filled value is Public.

- **`userCanSeeAction`** (`server/src/actions/action-visibility.service.ts:48-92`), in order: admin → yes; archived → no; staff preview active for this user → yes; Draft → no; **Public → yes, before any check that a user exists** (line 64 is above the `!user` test on line 68); no user → no; All members → yes; Participating groups → no cohort means no, otherwise saved admission or live cohort.
  `visibilityMode` is read nowhere else on the server (grep: only this file, the entity, the DTO and the project service).

- **Visibility and assignment are separate, and the cohort governs assignment in every mode.**

| Mode | Who can open and list it (once launched, not archived) | Who is asked to do it |
|---|---|---|
| Public | everyone, signed in or not; **cohort not consulted** | members in the cohort |
| All members | every signed-in member; cohort not consulted | members in the cohort |
| Participating groups | signed-in members in the cohort (saved admission or live) | members in the cohort |

  - Assignment: `computeAssignmentCore` returns Unassigned when `!inCohort` (`server/src/utils/action-user.ts:109`); `inCohort` comes from `computeViewerCohort` (`member-actions.service.ts:106-135`), which never looks at the visibility mode. A null cohort expression is in nobody's cohort (`single-member-cohort.service.ts:128-130`).
  - Completion: `computeCompletionBlock` returns `NotInCohort` when the member is outside the cohort (`user-action-status.ts:172`). A member who can see a Public task but is outside its cohort cannot submit it.
  - Reminders: recipients come from the cohort (`action-event-recipient.service.ts:153-270`), not the mode.
  - So the cohort governs **assignment, completion and reminders always, and visibility only in Participating groups mode**.

- **Member-facing surfaces.** All go through `userCanSeeAction`, so they behave as the table says:
  - Task list `GET actions/loggedIn` → `buildMemberFeed` → `listableActions` (`member-actions.service.ts:207`): visible tasks minus public-only ones; each carries the viewer's `assigned` flag. **Signed-in only** (`AuthGuard`, `actions.controller.ts:101-102`).
  - Task page `GET actions/slug/:id` → `userCanOpenAction` = `publicOnly || userCanSeeAction` (`actions.service.ts:328-340`). **`AuthOptionalGuard`** (`actions.controller.ts:172-173`), so a signed-out visitor with the link opens a launched Public task.
  - Search by name: `listableActions` (`actions.service.ts:498`).
  - Home feed, activity feed, global feed, task updates, notification references: `visibleActionIdsForUser` / `openableActionIdsForUsers` (`home-feed.service.ts:119,200`, `activity-feed.service.ts:73,313`, `global-feed.service.ts:125,376`, `action-updates.service.ts:353`, `notification-references.service.ts:236`).

  **Precision on "visible to signed-out visitors":** I found no signed-out *listing* of tasks in `actions.controller.ts`. What a signed-out visitor gets is the task page by direct link (and `sharePreview`, which is `@Public()`). Whether the public website lists tasks through another controller I did not trace.

**Verdict.** A new task from `/actions/new` or a suite is Public with no cohort: once launched it is openable by anyone with the link and visible to every member in lists and feeds, but **assigned to nobody** and completable by nobody until a cohort is set. A project-created task is Public with the previous step's cohort or Staff: visible to everyone, assigned to that cohort. "Public ignores the cohort" is true for visibility only.

### Data (`q34.sql`)

| Mode | All tasks | Launched | Drafts |
|---|---|---|---|
| public | 108 | 93 | 15 |
| all_members | 14 | 11 | 3 |
| participating_groups | 2 | 1 | 1 |

Launched tasks by launch year: 2025 — public 23. 2026 — public 70, all_members 11, participating_groups 1. By quarter, all_members launches: 8 in 2026-Q1, 2 in Q2, 0 in Q3, 1 in Q4. (By creation year the split is the same: every 2025 task is public.)

**Launched Public tasks that also have a cohort expression: 91 of 93.** The 2 without are public-only tasks. Top-level cohort type on those 91: `AllMembers` 52; a narrower expression 39 (AND 9, NOT 7, OR 7, Manual 5, FormFieldValue 5, Tag 2, USMember 2, CompletedAction 1, NonUSMember 1).

What this says (judgement): Public is not an oversight staff correct before launch; it is how 89% of launched tasks ran. For 39 launched tasks the cohort was narrower than everyone while the page stayed visible to all, so in practice staff use the cohort for "who is asked" and leave visibility open. Participating groups, the only mode where the cohort hides the task, has been launched once. Of the 15 Public drafts, 9 have no cohort yet.

```sql
select "visibilityMode", ("cohortExpression" is not null) has_cohort, "cohortExpression"->>'type' top_type, count(*)
from st where ma_date<=now() group by 1,2,3;
```

## 5. Editing live forms

**What the data allows.** A form version is a `form_snapshot_history` row; its date is the snapshot's `createdAt`. Snapshots are deduplicated by content hash, so re-saving earlier content is not counted again. History begins 2026-04-28, when a bulk write gave 54 forms their first recorded version, and two more bulk days (2026-11-13 and 2026-11-16) rewrote 54 and 51 task forms each. I treat those three days as scripted rewrites (judgement: too many forms per day to be hand edits) and exclude them. Raw figure for the record: 586 post-launch versions on 101 of 105 launched task forms, 53 of which are just a form's first recorded version.

**Restricted to tasks launched from May 2026 on, bulk days excluded** (`q5.sql`, `q5b.sql`):

- 52 launched task forms. **39 (75%) were saved again after the member-action date; 38 of them during the member window** (before the next event).
- 226 post-launch versions, 217 inside the member window. For comparison, the same forms have 1,990 versions before launch, so about one save in ten lands after launch.
- When: 61 versions within an hour of launch (19 forms), 103 between an hour and a day (25 forms), 51 between one and seven days (20 forms), 11 later (5 forms). Days with a save inside the window, per form: one day 17 forms, two days 11, three days 7, four days 3.

Classification of each post-launch version against the version before it, comparing input fields (`type = "input"`, top level and one level of nesting) by id, kind, option values and `required`:

| Change | Versions | Forms | In member window | …with responses already in |
|---|---|---|---|---|
| Copy, display or layout only (same inputs, kinds, options) | 197 | 36 | 188 | 156 |
| Option added, or `required` toggled, nothing removed | 18 | 12 | 18 | 17 |
| Input added, none removed | 6 | 5 | 6 | 3 |
| Option value removed or renamed on a kept input | 2 | 2 | 2 | 2 |
| Input removed (its id gone) | 3 | 3 | 3 | 1 |
| Input's kind changed under the same id | 0 | 0 | 0 | 0 |

- **87% of live edits are copy or display only.** Structural edits that can orphan answers (the last two rows that occurred) are 5 versions on 5 forms in six months, 3 of them after responses existed. **Small numbers.**
- An id change cannot be told from a removal plus an addition; "input removed" includes both.
- Variant forms (all dates, 10 forms): 36 post-launch versions on 9 forms, 33 copy-only, 1 with an input removed, 2 with an input added. Follow-up forms: 2 forms, too few to say anything.
- The three bulk days, for reference: 211 copy-only, 28 with an input removed (11 forms), 6 added, 7 option/required. Not counted above.

```sql
-- per post-launch version: inputs removed / added / kind changed versus the previous version (inp = flattened inputs per version)
select (select count(*) from inp p where p.form_id=c.form_id and p.n=c.n-1
        and not exists (select 1 from inp q where q.form_id=c.form_id and q.n=c.n and q.fid=p.fid)) removed, ...
from ver c where c.at_>c.ma_date and c.n>1;   -- full text in q5.sql
```

## 6. Paste JSON and events

**Code.**
- **Export** (`exportAction`, `server/src/actions/action-import-export.service.ts:39-74`; `ExportActionDto`, `dto/action.dto.ts:376-411`) copies the whole task row by `Object.assign`: every column including `visibilityMode`, `cohortExpression`, `publicOnly`, `staffPreview`, `archived`, `priority`, `createdAt`, `updatedAt` and `slug`, minus the derived counters; plus authors and reviewers always. Three parts are **optional, chosen by query flags**: `events` (the full event rows), `taskForm` (the form and its current snapshot) and `suite`. A `reminders` flag exists on the server, but the admin always sends `reminders: false`.
- **Admin defaults** (`apps/admin/src/pages/action-dashboard/useActionExport.ts:13-15`): Events **off**, Task form **on**, Suite **off**.
- **Import** (`importAction`, `:76-207`) inserts the task columns as given, then: reviewers; the suite found by name or created; authors; a new form from `taskForm`; and, **if the JSON has events, every one of them with its original date, status and `suiteManaged`** (`:186-195`). It drops reminder groups, activities, updates, follow-ups, the project, prerequisite ids, the old form id and the slug. No date check, no confirmation, and no DTO validation of the body (it is `JSON.parse`d and cast).
- So events are optional and off by default; a paste with them creates a task already in whatever status those dates imply.

**Data: is a pasted task recognisable?** No column records it. There is an indirect fingerprint (judgement, from how the insert behaves): the import passes the exported `createdAt` through, and a JSON date has millisecond precision, while rows stamped by the database clock have microseconds. A task whose `createdAt` ends in three zero microsecond digits is almost certainly pasted (chance alone would give about 0.1 such tasks in 124).
- **6 tasks carry it**; 5 of the 6 also have a task form with the same millisecond-precision `createdAt`, which is what a paste with the form included produces. That agreement is what makes me trust the fingerprint.
- By creation month: 2025-11 (1), 2026-01 (2), 2026-11 (3). Two of the November ones are a same-timestamp pair of archived drafts made on 2026-11-24 after the sync, so probably staging-side. **Roughly 4 pastes in production in 16 months.**
- **None came with events**: no event on any of the 6 has a millisecond-precision `updatedAt`, and the 4 that launched got their events later in the normal way. So there is no sign that Paste JSON with Events ticked has ever been used.
- Task ids are in `createdAt` order throughout, so each paste happened within a day of its source being created (consistent with building on staging and pasting to production before the nightly wipe; judgement).
- Limits: a pasted task whose `createdAt` was later rewritten would be missed (nothing rewrites it); an export without the task form would show only the task-side fingerprint (1 of 6).

```sql
select count(*) filter (where extract(microseconds from "createdAt")::int % 1000 = 0) from action;        -- 6 of 124
select count(*) filter (where extract(microseconds from "updatedAt")::int % 1000 = 0) from action_event;  -- 1 of 246, not on a pasted task
```

## 7. Reminders

### Code: the two open points

**Can a reminder with an absolute send time go out before its task has launched? Yes in some configurations; nothing checks for launch, but one side effect usually stops it.**
- Selection has no launch test. `findSendableReminderGroups` picks an Absolute group purely on `sendAtAbsolute` being inside the window (`server/src/notifs/action-event-reminder.service.ts:251`); it never compares it with the member-action event's date or the task's status. Recipients come from the cohort (`findReminderGroupCohort`, `filterForShouldRemind`, `action-event-recipient.service.ts:153-270`), again with no status test.
- What can stop it is at send time. `processOne` (`action-event-notif.worker.ts:216-249`) builds the member's uncompleted-task list through `findUncompletedTasks` (`member-actions.service.ts:414-440`), which goes through the member feed. A Draft task is not listable (`userCanSeeAction`) and is filtered again by `status !== Draft`. **If the list is empty, the worker returns without sending**, unless the group's cohort type is `group_leads_with_uncompleted` and `excludePreviouslyNotified` is off.
- So before launch:
  - `useSuiteTaskCount` on (the default) and a member-directed cohort type: the list is the suite's live tasks. If every task in the suite is still Draft, it is empty and **nothing is sent**. If another task in the suite is already live and uncompleted, **it sends**.
  - `useSuiteTaskCount` off: the list is all of the member's open tasks anywhere (`action-event-notif.worker.ts:171-174`). If they have any, **it sends before launch**, with this group's text.
  - `group_leads_with_uncompleted` without `excludePreviouslyNotified`: the empty-list return does not apply (`:244-248`), so **it can send to group leads before launch**.
- Creation does not prevent it either: `reminderGroupFieldsFromDto` only requires the event to be a member-action event (`reminder-group.service.ts:239`). I found no server rule that an absolute time must be after that event's date. Only the suite launch panel checks, in the client.
- Not traced: the missed-suite path (`processMissedSuite`) and the delivery service.

**Does a suite reminder still send when its only tasks are drafts? No, for the cases that exist in the data.** A group must hang on a member-action event, so "only drafts" means that event is still in the future. With `useSuiteTaskCount` on, every suite task is Draft, the list is empty, and the worker returns before creating a notification. The same two exceptions apply: `useSuiteTaskCount` off, and group-leads groups without `excludePreviouslyNotified`. The same send-time list is what keeps archived tasks out of a reminder's task list, though not out of the recipient calculation.

### Data (`q7.sql`, `q7b.sql`)

- **367 reminder groups, all on tasks in a suite, all carrying the suite's id, all with `useSuiteTaskCount` on.** They hang on 59 member-action events in 59 suites: one task per suite, as the CUJ says. **Standalone tasks: 0 reminder groups.**
- 59 of 64 launched suites have reminder groups (2025: 9 of 13; 2026: 50 of 52; one suite has launches in both years). Groups per suite: 7 in 38 suites, 5 in 10, 8 in 4, 6 in 2, 1 in 4, 3 in 1. Seven is the default set.
- Timing mode: within_relative_range 194 (84 of them group-leads), from_deadline 112, event_launch 52, absolute 6, within_range 3. Cohort type: all_uncompleted 283, group_leads_with_uncompleted 84.
- **No absolute or range group is timed before its member-action event** (0 of 9). The pre-launch path has never been set up. **Nine rows.**
- Older per-task reminders (`action_reminder`): 21, all sent, 2025-10 to 2025-11, none on a standalone task. Unused since.
- **Sent for a draft?** 20,477 notifications still linked to their group: 0 created before their group's member-action date; 0 created while every task in the suite was a draft. Of 19,029 linked to an event: 0 before it.
- One anomaly: 23,906 (notification, task named in it) pairs; in **100, all in 2026-03 and all about one task**, that task has no event dated before the notification. Its current events are dated about 72 days later and were written after those notifications. Judgement: the task was live in March and its launch event was later removed and re-added (it is the 2026-06 Events-tab launch in question 1), not a reminder about a draft. The data cannot settle it, because deleted events left no row. 2,000 older notifications carry no task list and could not be checked this way.

## 8. Standalone tasks

**Data** (`q1.sql`). **15 tasks have no suite. 3 of them ever launched; the last in 2026-04** (1 in 2025-12, 2 in 2026-04). All 3 are public-only tasks, now completed.
- Of the other 12: 10 are archived, and none has any event. Created 2025-09 (3), 2026-03 to 2026-06 (5), 2026-11 (3, of which 2 are the probable staging-side pasted pair).
- So launching a task outside a suite is rare (3 of 105) and has only been done for public-only tasks. No ordinary member task has launched without a suite. **Three rows.**

```sql
select count(*) no_suite,
       count(*) filter (where exists (select 1 from action_event e where e."actionId"=a.id
                                      and e."newStatus"='member_action' and e.date<=now())) launched
from action a where "suiteId" is null;   -- 15, 3
```

## 9. Anything else that contradicts CUJ-TASK.md or CUJ-SUITE.md

Contradictions or corrections:

1. **CUJ-SUITE "Members can't see a Draft task; once any event's date has passed, they can (subject to visibility mode and cohort)."** The cohort limits visibility only in Participating groups mode, which one launched task has ever used. For the other 104, the cohort decided assignment and nothing about visibility (question 4).
2. **CUJ-TASK trap 3, "the task would be visible to everyone, signed in or not."** True for the page by link. It leaves out that such a task, having no cohort, is assigned to nobody and nobody can submit it; and I found the signed-out exposure only on the task page and share preview, not a signed-out listing.
3. **CUJ-TASK §3 reminders, "*(Not traced: whether an empty list suppresses the send.)*"** It does (`action-event-notif.worker.ts:244-248`), with the two exceptions in question 7. The "*plausible*" pre-launch absolute send is therefore real only with `useSuiteTaskCount` off, a live sibling task in the suite, or a group-leads group. No group in the data has `useSuiteTaskCount` off; 84 are group-leads groups.
4. **CUJ-SUITE "What a suite is: one launch; all its tasks share the suite's start."** Holds for 60 of 64 launched suites. But 38 of the 64 contain one task, so the typical suite is a single task plus its reminders rather than a bundle. And 4 suites have more than one launch date.
5. **CUJ-TASK §5 lists three standalone launch routes as if comparable.** In the data: Events tab on a no-suite task, 3 ever (all public-only); project Schedule release, 1 ever; paste with events, 0. Nearly every launch (88 of 105) is a suite-managed event.
6. **CUJ-TASK §6 "Action events on the dashboard can't be edited or deleted."** The March 2026 anomaly (question 7) and the 8 Events-tab launch events dated more than a day before their last write suggest launch events have been replaced or re-dated by some route. Could be the suite event editor, a script or an older UI; the data cannot say which. Judgement, weak.
7. **CUJ-TASK §8 open question, "whether Planned, Abandoned or Failed events are ever added to drafts on purpose."** Planned once, in 2025; Abandoned, Failed and Resolution never (question 2).
8. **CUJ-TASK §1 "Once a suite has tasks, the page offers no 'add task'."** Consistent with the data but worth knowing: only 1 launched suite contains a task without a member event (an archived one), and no launched suite holds an unarchived draft. Late joiners into launched suites are not happening.

Things the data supports as written: every launched task has a task form (0 launched without one); office action always follows member action (0 office or completed events dated before the member event); one member-action event per task; reminders live on one task per suite; 5 suites have no tasks and 4 have never launched. Staff preview is currently on for 3 tasks, 1 of them outside any project, so it is used a little on dashboard tasks too. One suite is partitioned.

---

## Summary

1. **How tasks get launched** — 105 launched: 102 in a suite, 3 not. 88 through a suite-managed event (52 suite-wide across 22 multi-task suites, 36 on one-task suites), 13 individually from the Events tab (10 of those before suites existed), 1 with its own date. Schedule release: used once (2026-11). 44 tasks are in a project, all since 2026-09. *Confidence: high on the split; Schedule release rests on one row.*
2. **Event statuses** — only member_action (105), office_action (79), completed (61), planned (1). Planned took a draft live once, in 2025. Abandoned, Failed, Resolution never used; Completed never added without a member event. *High, barring events deleted without trace.*
3. **Public-only** — 4 tasks; 1 is a draft, 0 archived. *Exact, but four rows.*
4. **Visibility default** — verified in code: column default Public, DTO has none (required), `/actions/new`, suite and project paths all send Public; Public is visible to anyone and skips the cohort. Refined: the cohort still governs assignment, completion and reminders in every mode, and visibility only in Participating groups. Data: 93 of 105 launched tasks are Public, 91 of those with a cohort (39 narrower than all members). *High.*
5. **Editing live forms** — for tasks launched since May 2026, 39 of 52 forms (75%) were saved after launch, 38 during the member window; 197 of 226 such saves are copy or display only; 5 removed an input or an option value. *Medium: six months of history, three bulk-rewrite days excluded by judgement, structural counts are tiny.*
6. **Paste JSON** — export carries the whole task row; events, task form and suite are optional, with events off by default; import inserts any events with their original dates. No column marks a paste; a timestamp-precision fingerprint points to 6 pasted tasks (about 4 in production), none with events. *Code: high. Fingerprint: medium, an inference.*
7. **Reminders** — code: no launch check; a pre-launch or all-drafts send is suppressed only because the member's task list is empty, and not when `useSuiteTaskCount` is off, a sibling task is live, or the group targets group leads. Data: 367 groups, all on suites (59), none on standalone tasks; none timed before launch; no notification sent before its launch or while its suite was all drafts; one unexplained 100-notification case on one task. *Code: high for what was traced. Data: high that it has not happened, with the one anomaly open.*
8. **Standalone tasks** — 15 without a suite; 3 launched, all public-only; last in 2026-04. *Exact, three rows.*
9. **Contradictions** — the cohort does not limit visibility for almost any real task; the empty-list check does suppress draft reminders; most suites hold one task; the non-suite launch routes are nearly unused. *As per the items above.*
