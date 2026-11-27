# Data check: reference prototype against the server

Checked against the code at c722280863.

**Scope.** Every number, field, chart, column, badge and list on each screen in `.scratch/greenfield/prototypes/ref/` (screens files, `data.js`, `app.js` counts), checked against:
- the generated client: `shared/client/types.gen.ts` and `sdk.gen.ts`
- the server controllers and services I read
- the hooks today's admin uses (`apps/admin/src/lib/*`, `sidebar.tsx`, `UsersList.tsx`)

**What each label means.** Every classification is *researched*: it comes from the named type or code, not from running the API. Proposed substitutes are *agent judgement*.

**Classes:**
- **P**: provided by an endpoint and field
- **D**: derivable on the client from provided data. "Heavy" means it needs bulk fetches, which today's admin already does in places.
- **N**: not available; needs a server change. Each N names the closest thing the server does provide.

**Facts the rest of this report relies on:**
- **Task list.** `actionsFindAllWithDraftsAdmin` (`/actions/all`) returns `AdminActionListItemDto[]` with: `status`, `events[]` (`newStatus`, `date`), `suite`, `project` (id, name, category only), `memberActionStart`, `memberActionDeadline`, `usersJoined`, `usersCompleted`, `usersWontComplete`, `usersDismissed`, `priority`, `taskFormId`, `variantFormIds`, `updates[]`, `cohortExpression`, `visibilityMode`, `createdAt`, `updatedAt`.
- **Suites.** `actionSuitesSuitesAdmin` / `actionSuitesSuiteAdmin` return `ActionSuiteDto`: `id`, `name`, `actions` (ActionDto with `status`, `events`, `project`, `usersCompleted`), `events`, `reminderGroups`, `generalUpdates`, `isPartitioned`. A suite has **no status, start/end, rhythm, createdAt or creator**.
- **Projects.** `projectsFindAllAdmin` returns `AdminProjectDto`: `id`, `name`, `category`, `slug`. `projectsFindOneAdmin` adds `steps[]`. A project has **no colour, description or lead**.
- **Members.** `userListAdmin` (`/user/list`) returns every user, unpaginated, as `AdminUserListItemDto`. The service loads no relations, so `tags` and `communities` are absent. The DTO also has **no createdAt, last-active or completed count**. Today's `UsersList.tsx` loads all users plus `useTagsAdmin` (tags with users), `useActionRelationsAdmin` and time spent, then filters, sorts and pages on the client.
- **Analytics.** `analyticsGetDailyStatsAdmin(date, endDate)` returns one `DailyStatsDto` per day. Each is a **cumulative snapshot** (`analytics.service.ts:89-134`):
  - `signedMembers` = members with an active contract
  - `actionsCompleted` = all-time latest completions
  - `invitesCreated` and `invitesAccepted`
- **Forms have no draft state.** `tasksUpdateFormAdmin` saves the schema and makes a new snapshot. There is no separate publish step, no draft and no published flag.

---

## Rail and palette (app.js)

| Item | Class | Source |
|---|---|---|
| Inbox badge (texts need a reply) | P | `mmsThreadNeedsReplyThreadsAdmin`, the array's length (`useNeedsReplyCount`) |
| Welcome queue badge | P | `actionsGetWelcomeQueueAdmin` → `members.length` |
| Awaiting a group badge | P | `userGroupAssignmentGetGroupAssignmentMembersAdmin`, length (as `sidebar.tsx` does) |
| Partnership responses badge | D | `actionPartnershipsFindAllResponsesAdmin`, counting responses with `notesHistory.length === 0`. This is today's rule in `sidebar.tsx:16-24`; "to review" means "has no note". |
| Account row (name) | P | `authMe` |

## Home

| Item | Class | Source / note |
|---|---|---|
| "Good morning, Charlie", date | P/D | `authMe.user.name`; the date is client-side |
| Needs you: 4 queue counts | P/D | As in the rail above |
| Members tile 3,912 | P | `analyticsGetAggregateStatsAdmin.signedUsers`, or `userNmembers.count` |
| Members tile % change and 7-point sparkline | D | `analyticsGetDailyStatsAdmin` over 14 days, using `signedMembers` per day |
| Active this week 1,486, change and sparkline | **N** | No last-active or per-period activity. `TimeSpentForUserDto` is `{userId, timeSpent}` with no date. Closest: completions this week (below), or members with a completion in the last 7 days via `actionsActionRelationsAdmin` → `latestActivityAt` (heavy, and only the latest activity per task). |
| Tasks completed 1,028, change and sparkline | D | Daily stats: the difference in `actionsCompleted` between snapshots, summed over 7 days |
| New members 86, change and sparkline | D, with a caveat | The difference in `signedMembers`. That is **net** (signings minus suspensions), not new signups. Gross needs N. Closest gross: the difference in `invitesAccepted`, or counting `contract_signed` entries in `eventLogFindAllAdmin` (paged). |
| "Last 7 days" range picker | D | Daily stats take any `date`/`endDate` |
| Tasks in member action table: task, suite, project | P | `/actions/all` filtered to `status === 'member_action'`; `suite.name`, `project.name` |
| Completion % and bar | D | `usersCompleted / usersJoined` |
| Deadline / "In 2 days" | P/D | `memberActionDeadline` |
| Project colour swatch | **N** | Projects have no colour. Closest: a client-side colour assigned stably from `project.id`. It can't be edited, and the project record's "Color" row would have to go. |
| Completions per week chart (7 weeks) | D | Daily stats over 49 days, differencing `actionsCompleted` week to week |
| Live activity feed (accepted an invite, completed, texted, reminder sent, partnership replied, added to group) | Mostly N | No admin activity stream. Pieces exist separately: `actionFeedGetGlobalFeed` (completion groups, new members, forum comments, task updates), `shareUrlsFindInviteFeedAdmin` (invites), and `eventLogFindAllAdmin` (sms_inbound, contract_signed…). Live streaming exists only for texts (`/mms-threads` socket). Closest: a merged, polled list of global feed, invite feed and event log. "Reminder N sent to 271", "partnership replied" and "added to group by X" have no source. |

## Activity › Event log

| Item | Class | Source |
|---|---|---|
| Event rows (message, member, time) | P | `eventLogFindAllAdmin` → `items[]`: `event`, `message`, `user.displayName`, `createdAt` (paged) |
| Type filter | P | `eventType` query parameter |
| Member filter, free-text filter | **N** | No user or search parameter. Closest: filter one fetched page on the client. |
| "Live" badge, streaming in | **N** | No event-log socket. Closest: poll. |
| Export | D | Build a CSV on the client from the fetched pages |
| The prototype's sample rows (completed a task, invite accepted…) | **N** as event-log rows | `EventType` is a closed list (account_created, contract_signed, sms_inbound, forum_action_autocomplete, …). Task completions and invites are not in it. Show real event types. |

## Activity › Scheduled jobs

| Item | Class | Source |
|---|---|---|
| Rows, date, kind badge | P | `actionsScheduledPlansAdmin(rangeStart, rangeEnd)`: `suspensionPlans[]` and `forumAutocompletePlans[]`, each with a `date` |
| Task it completes | P | `forumAutocompletePlans[].action` (`id`, `name`) |
| Member count and member list | P | `users[]` (ProfileDto: `displayName`, `profilePicture`) |
| PT and UTC times | D | Format `date` |

## Members (People)

| Item | Class | Source / note |
|---|---|---|
| Name, phone, email | P | `userListAdmin`: `name`, `phoneNumber`, `email` |
| Avatar | P | `profilePicture` |
| Groups column, "+1" | D (heavy) | Not on the list DTO. Join with `communityGetCommunitiesAdmin` (each group's `users[]`), or `communityGetAllMemberContactInfoAdmin`. |
| Tags column | D (heavy) | `userTagGetTagsAdmin` (tags with `users[]`), joined on the client as `UsersList.tsx:79-87` does |
| Status pill: Active / Away / Welcome queue / Paused | D, partly | Active = `hasActiveContract`. Suspended = `lastContractEvent.type === 'suspended'`. Away = `userAwayRangeGetAwayRangesInWindowAdmin` for today. Welcome queue = membership in the welcome-queue response. "Paused" has no source; use "Suspended". |
| Tasks done | D (heavy) | `actionsActionRelationsAdmin` → count of `relations[].status === 'completed'` per user, which today's admin already fetches. Covers only the actions that response includes. |
| Last active (column, sort, filter) | **N** | No last-seen field anywhere. Closest: time spent (`analyticsGetTimeSpentPerUserTotalAdmin`, today's default sort), or latest `latestActivityAt` across relations. |
| Joined filter, "Member since" | **N** on the list | No `createdAt` on user DTOs. Closest: first `signed` contract event. That needs `userUserDetailAdmin.contractEvents` per member, so it fits the peek panel but not the list. |
| "Current task" filter | D (heavy) | Action relations |
| Tab counts: All 3,912 / Staff 8 / Away 47 | D | All = list length. Staff = `staff` flag. Away = away ranges today. |
| Total and "1–50 of N" | D | Client-side paging over the full list, as today |
| Server-side filtering, search, paging | **N** | The list takes no query parameters. Client-side works at today's size. |
| Map layout | P | `userCityCountsAdmin`: `cityName`, `count`, lat/long. These are **cities, not neighbourhoods or groups**, and the map ignores the table's filters ("same filters as the table" is N). |
| Bulk: add to group | P, per member | `communityAddMemberAdmin`, one call per member. "Select all N matching" as a server job is **N**. |
| Bulk: tag | P, per member | `userTagAddUserToTagAdmin`, one call per member |
| Bulk: text N members | **N** | Only per-member sends: `mmsThreadSendTextAdmin` (`/mms-threads/{userId}`). There is no broadcast and no `{first_name}` substitution. Closest: a loop of single sends, without variables. |
| Export CSV | D | On the client |
| **Peek:** status, phone, email, groups, tags | P/D | `userUserDetailAdmin` (`tags`, `communities` loaded, `location`, `invitedBy`) |
| Peek: last active, tasks done | N / D | As above |
| Peek: current tasks with Completed / Started / Not opened | D, partly | `actionsActionRelationsForUserAdmin` → `relations[].status` (`completed`, `todo`, `wont_complete`, `missed_deadline`, `away`, …). "Started" and "Not opened" are **N**; use the real pill states. |
| Peek: recent (completed X, texted the inbox, invited Y) | D, partly | Completions from `actionFeedFindCompletedForUser` or `actionFeedUserFeed`. Texts from `mmsThreadGetThreadAdmin`. Invites from `userOnetimeInviteGetOnetimeInvitesAdmin`. All merged on the client. |
| Peek: `m1040` id | P | `id` (a number) |

## Inbox

| Item | Class | Source |
|---|---|---|
| Needs reply queue and count | P | `mmsThreadNeedsReplyThreadsAdmin`: `threadId`, `phoneNumber`, `members[]`, `lastMessageBody`, `waitingSince` |
| All queue | P | `mmsThreadListThreadsAdmin` (page, limit, digit search): `lastMessageBody`, `lastMessageDirection`, `lastMessageAt` |
| Thread name, time, preview, "You:" | P | Above. `lastMessageDirection` gives "You:" |
| Unread dot | **N** | No per-staff read state. Closest: membership in Needs reply. |
| "Mira is typing…" | **P** | `/mms-threads` socket `Composing` event (`mmsThreadsLive.tsx`, `useComposerNames`). The NOTES' "no presence" is wrong for this one thing. |
| "2 new messages" pill | D | `ThreadChanged` socket event, then refetch |
| Conversation bubbles, time, sender name, Delivered | P | `mmsThreadGetNumberThreadAdmin` → `messages[]`: `body`, `direction`, `status`, `createdAt`, `sentByStaff`, `sentByName`, `media[]` |
| Automated reminder bubble "Automated reminder 1" | D, partly | Automated = `!sentByStaff` and outbound. Which reminder it was is **N**. |
| Photo | P | `media[]`, `mmsThreadMediaAdmin` |
| "SMS · Alliance main line" | **N** (static copy) | No line or number name in the DTO. Drop it or make it a constant. |
| Mark handled / needs reply / opt out | P | `mmsThreadMarkThreadHandledAdmin`, `…NeedsReplyAdmin`, `…OptedOutAdmin` |
| Send, with a 10 s cancel | P, plus client | `mmsThreadSendInThreadAdmin`. The cancel window is a client delay. |
| Segment counter | D | Client |
| Attach image (MMS) | Check | `SendStaffTextDto` wasn't inspected. Treat it as N until checked. |
| Context pane: name, phone, status, member since, groups, tags | P/D | `userUserDetailAdmin` (member since is N, as above) |
| Context pane: current tasks and pills | D | `actionsActionRelationsForUserAdmin` |
| "Survey started, not submitted. Stopped at page 2 of 2." | **N** | Form drafts are member-only (`tasksGetFormDraft` is the member's own). Closest: none. |
| "Completed N tasks · last active" | D / N | As in Members |

## Tasks (Timeline / List / Priority)

| Item | Class | Source |
|---|---|---|
| Header "18 tasks in 4 suites and 5 projects" | D | Counts from `/actions/all`, `actionSuitesSuitesAdmin`, `projectsFindAllAdmin` |
| Suite swimlanes, project grouping, "No suite" / "No project" | P | `suite`, `project` on each action |
| Lane meta: suite status pill | **N** | Suites have no status. Closest: derive from the actions' statuses (any member_action → Live; all completed → Completed; all draft → Draft). That would be a client rule; mark it agent judgement. |
| Suite span bar "Nov 16 – Dec 20 · weekly" | D, partly | Start/end from the min/max of the suite's `events` and its actions' events. "Weekly" (rhythm) is **N**; it isn't stored. |
| Office action segment | D | `events[]` with `newStatus === 'office_action'` |
| Member action segment, deadline diamond | P | `memberActionStart`, `memberActionDeadline` |
| Resolution segment | D | `events[]` with `resolution`, up to the next event |
| Reminder dots | D (heavy) | Reminder groups hang off suites (`ActionSuiteDto.reminderGroups`, timing as absolute or relative to the deadline). Upcoming send times come from `actionRemindersGetNotificationScheduleAdmin(windowStart, windowEnd)` → `scheduledFor`, `actionId`. Past sends need `actionRemindersSentNotifsForGroupAdmin` per group. |
| Project chips with counts, project colours | D / **N** | Counts derive. Colours as in Home. |
| List: status pill | P | `status` (the 8 `ActionStatus` values) |
| List: office action date, member action range | D/P | As above |
| List: Reached | P | `usersJoined` |
| List: Completion % | D | `usersCompleted / usersJoined` |
| Priority list, order, reorder | P | `priority`; `actionsSetPriorityAdmin` (also takes general-update priorities) |

## Suites list and suite record

| Item | Class | Source |
|---|---|---|
| Suite name | P | `ActionSuiteDto.name` |
| Status | **N** | As above. Derive it, or drop it. |
| Runs, weeks | D | From events |
| Tasks "2 member action · 3 planned…", status stack | D | `actions[].status` |
| Projects in suite (chips and counts) | D | `actions[].project` |
| Record subtitle "N tasks in M projects" | D | |
| Week rhythm cards (starts and deadlines per week) | D | `memberActionStart`/deadline per action (from `/actions/all`, joined by suite id) |
| "Week 3 of suite" on a task | D | Start of suite to member start. `UserActionSummaryDto.weekNumber` also exists. |
| Reminders tab: reminder name | P | `reminderGroups[].name` |
| Reminders tab: task, send time | D | `scheduledFor` from the notification schedule, or the group's `sendAtAbsolute` / `sendAtSecondsFromDeadline` against the deadline event |
| Reminders tab: audience | P | `cohortType` (`all_uncompleted`, `group_leads_with_uncompleted`, `tag`, `custom`) |
| Reminders tab: state Sent / Scheduled | P | `allSent` |
| General updates tab: title | P | `generalUpdates[]` (`name`, `startDate`) |
| General updates tab: "Seen by 2,904" | **N** | No view counts on general updates. Closest: none. |
| Partition tab | P | `isPartitioned`; `suitePartitionsPartitionAdmin` |
| Details: Rhythm "Weekly, Mon start" | **N** | Not stored |
| "Created by Theo Vance on Nov 2" | **N** | No creator. `createdAt` is on the entity but not in `ActionSuiteDto`. |
| New suite flow: name | P | `actionSuitesCreateSuiteAdmin` takes only `name` |
| New suite flow: first week, rhythm, start/deadline times | N as stored fields | They would have to become per-event writes: `actionSuitesBatchUpdateSuiteEventsAdmin` / `actionSuitesAddSuiteEventAdmin`. The rhythm itself isn't persisted. |

## Projects list and project record

| Item | Class | Source |
|---|---|---|
| Name | P | `AdminProjectDto.name` |
| Colour | **N** | Closest: a colour derived from the id |
| Description | **N** | Closest: `category` (goal tags) |
| Lead | **N** | Closest: none. Drop it. |
| Status stack and counts, suites list | D | `/actions/all` filtered by `project.id` |
| Tasks by suite tables | D | Same |
| Timeline | D | Same, or `projectsFindOneAdmin.steps[]` (`memberActionAt`) |
| Task updates tab | D | `actionUpdatesAllUpdatesAdmin` filtered by the project's action ids |
| Details: Tasks count | D | |

## Task record

| Item | Class | Source |
|---|---|---|
| Name, status pill, suite, project | P | `actionsFindOneAdmin` (AdminActionDto) |
| Phase strip: dates and "Now" | D | `events[]` (`newStatus`, `date`) and `status` |
| "Deadline in N days" | D | `memberActionDeadline` |
| Subtitle "Reached 1,240 · 62% completed" | P/D | `usersJoined`, `usersCompleted`. Also `analyticsGetActionStatsByIdAdmin.completionRate`. |
| Funnel: Reached | P | `usersJoined` |
| Funnel: Completed | P | `usersCompleted` |
| Funnel: Opened, Started | **N** | Closest: Withdrawn (`usersWontComplete`) and Dismissed (`usersDismissed`), which are real stages. Click-through on reminders comes from `analyticsGetReminderGroupClickRatesAdmin`. |
| Funnel: "+38 today" deltas | D | From `analyticsGetActionCompletionCurvesAdmin` (hourly or daily buckets of completions) |
| Completion by variant (line chart over days) | **N** as a time series | `actionFormsListFormVariantsAdmin.stats[]` gives per-variant `assigned` and `submitted` totals only. Completion curves are per action, not per variant. Closest: a bar per variant (`submitted / assigned`) and the action's overall curve. |
| "Variant A is 12 points ahead" | D | From the variant totals |
| Upcoming messages | D, partly | Reminders from the notification schedule. Task updates from `updates[]` (`visibleAt` / `notifiedAt`). Follow-ups: see Messages tab. |
| Variants tab: name, split | P | `variants[]`: `name`, `splitValue` |
| Variants tab: Reached | P | `stats[].assigned` |
| Variants tab: Completion % | D | `submitted / assigned` |
| Variants tab: Headline copy | D (heavy) | It lives in each variant's form schema: `tasksGetFormAdmin(variant.formId)` |
| Variants tab: last 7 days sparkline | **N** | Closest: none per variant |
| Messages tab: task updates (sent or scheduled), audience | P | `actionUpdatesAllUpdatesAdmin` / `updates[]`: `title`, `date`, `visibleAt`, `notifiedAt`, `notifyType` (`action_cohort`, `all_members`, `tag`) |
| Messages tab: reminders, audience | P | Reminder groups on the suite: `cohortType`. Recipients come from `plansForGroupAdmin` / the schedule's `recipients`. |
| Messages tab: "Follow-up" messages to completers | **N** | The server has no follow-up *messages*. `followUpForms` are follow-up **forms** (dated, with a cohort expression), and no reminder `cohortType` targets completers. Closest: show follow-up forms as their own row type. |
| Message stats: Delivered | D (heavy) | `actionRemindersSentNotifsForGroupAdmin` → `mail.status` / `mms` / `pushes[].receiptStatus` |
| Message stats: Opened | D (heavy) | `mailClickedAt` / `mmsClickedAt` / `pushes[].openedAt`, or `analyticsGetReminderGroupClickRatesAdmin` |
| Message stats: "Completed after" | **N** | Closest: none |
| Message stats for task updates | **N** | Closest: none |
| "est. 380" audience estimates | **N** | Closest: current recipient counts from the schedule |
| Compose: post a task update | P | `actionUpdatesCreateUpdateAdmin` then `actionUpdatesNotifyUpdateAdmin` / `publishUpdateNowAdmin` |
| Compose: audience choices All reached / Not started / Completed | **N** as written | Task updates notify `action_cohort`, `all_members` or `tag`. "Not started" maps to reminder cohort `all_uncompleted`. "Completed" doesn't exist. |
| Compose: `{first_name}` variables | **N** in task updates | Reminders support keyword substitution (`actionRemindersPreviewTextMessageAdmin`); task updates don't. |
| Compose: "Preview for Ana Ruiz" | **N** for task updates | `previewTextMessageAdmin` covers reminder text only |
| Responses tab: rows, member, submitted, answer columns | P | `tasksGetFormResponsesAdmin(formId)` → `answers`, `user`, `createdAt`, `formSnapshotId`. Across variant forms: `tasksGetFormResponsesByFormsAdmin`. |
| Responses tab: variant column | D | From `formId`: task form vs `variantFormIds` |
| Responses tab: count "769" | P | `tasksGetFormResponseCountsAdmin` |
| Responses tab: filter by any field, export | D | Client-side over the full fetch |
| Response peek (each answer) | P | `answers` and `schemaSnapshot` |
| Activity tab (who edited what, sends, phase starts) | **N**, mostly | No audit log on actions. Closest, derived: phase starts from `events[]`, task updates from `updates[]`, reminder sends from sent notifs. "Mira edited variant B" has no source. |
| Details: Form link | P | `taskFormId` |
| Details: Audience "Bronx, Harlem groups" | D | Parse `cohortExpression`. `visibilityMode` = `participating_groups`. |
| Details: Priority "3 of 9" | D | `priority`, ranked among live or planned actions |
| "Created by Theo on Nov 14 · Last edited by Mira, 2h ago" | **N** for people | `createdAt` and `updatedAt` are P. `authors[]` exists on ActionDto but means member-facing authors, not editors. |
| Duplicate task | **N** as one call | Closest: `actionsExportActionAdmin` then `actionsPasteJsonAdmin` |
| Abandon task | P | `actionsAddEventAdmin` with `newStatus: 'abandoned'` |
| Preview as member | P | `staffPreview` flag |

## Forms list and form record

| Item | Class | Source |
|---|---|---|
| Form name | P | `tasksListFormsAdmin` → `title` |
| Used by task | P | `usedInAction` (`id`, `name`) |
| Fields count | P | `schemaCounts.fields` (`pages` too) |
| Responses count | P | `tasksGetFormResponseCountsAdmin({formIds})`, one call for all forms |
| Tabs All / Used by a task / Standalone | D | `usedInAction` present or absent |
| Version "v4" | D (heavy) | `tasksGetResponseSnapshotMigrationAdmin(formId)` per form lists the latest snapshot plus snapshots that have responses. The number of snapshots **without** responses is unknown, so the "vN" ordinal is **N**. |
| Status Published / Draft changes / Never published | **N** | Saving is publishing: every save makes a snapshot. Closest: none. Drop the status column. |
| Updated "2h ago" | D (heavy) | `latestSnapshot.createdAt` from the per-form migration call. The list DTO has no `updatedAt`. |
| Record subtitle | P/D | As above |
| Responses tab, version filter | P/D | `tasksGetFormResponsesAdmin` → `formSnapshotId` |
| Versions tab: version rows, response counts per version | D, partly | Snapshot-migration groups give `snapshot.createdAt` and `responses[]` per snapshot, but only for snapshots with responses plus the latest |
| Versions tab: "By" (who published) | **N** | Closest: none |
| Migrate responses to the latest | P | `tasksMigrateResponseSnapshotsAdmin` |
| Duplicate | D | `tasksGetFormAdmin` then `tasksCreateFormAdmin` |

## Form builder

| Item | Class | Source |
|---|---|---|
| Pages, fields, labels, help, required, options | P | Form `schema` (`common/src/forms/*`) via `tasksGetFormAdmin` / `tasksUpdateFormAdmin` |
| Conditional visibility | P | `visibleIfFormula` (equals, includesOption, hasValue, …) |
| Expert message block | P | `expertMessage` display block |
| Variables list | P | `variable-inputs.ts` (field, aggregate, answeredCount, …) |
| "Saved · 2m ago" | D | Client time of the last successful `updateFormAdmin` |
| Conflict safety | P | `expectedFormSnapshotId` |
| "Version 4 is published", "Publish changes", "Publish version 5?" | **N** | There is no draft/publish split; each save is a new snapshot. Closest: Save, and show "Saved · creates a new version". |
| Publish dialog: fields added / changed / removed | D | Diff the edited schema against the loaded schema on the client. This works only before saving, since there's no stored draft. |
| Publish dialog: "769 responses stay on v4" | D | Response count |
| Field palette: Short text, Long text, Number, Phone, Email, Date, Single/Multiple choice, Dropdown, Yes or no, Ranking, File/Photo upload, Heading, Paragraph, Expert message, Image, Video, Divider, Progress | P | `input`/`text`, `textarea`, `number`, `phone`, `email`, `date`, `radio`, `checkbox`/`multiselect`, `select`, `toggle`, `ranking`, `file`/`image`; blocks `header`, `text`, `expertMessage`, `images`, `video`, `divider`; `progressbar` |
| Field palette: Signature, Member picker, Group picker, Audio note, Address, Date and time, Rating, Callout | **N** | Closest: `contract` (signing), `custom`, none, `file`, `city`, `date` + `time`, `range`, `quote`/`label` |
| Device preview | P | The member form renderer |

---

## Every "not available" item

1. Home: **Active this week** count, change and sparkline. No activity-by-date data.
2. Home: **gross New members**. Daily stats give only net active contracts.
3. Home and Activity: **live organisation activity feed** that merges invites, completions, texts, reminder sends, partnership replies and group adds; event-log streaming and member/text filters.
4. Event log rows for completions and invites. They aren't `EventType`s.
5. **Project colour, description, lead.**
6. **Suite status, rhythm, creator, created date** (in the DTO). The New suite flow's rhythm and start/deadline settings aren't stored.
7. Members: **Last active** (column, sort, filter), **Joined / Member since** on the list, the **"Paused"** status, server-side filtering and paging, select-all-matching bulk jobs, the **bulk text** broadcast with `{first_name}`.
8. Members map: **neighbourhood or group** circles and following the table's filters. Only city counts exist.
9. Member and inbox task pills **"Started" / "Not opened"**, and "survey started, stopped at page 2".
10. Inbox: **unread** state; line name; automated reminder index. MMS attach is unverified.
11. Task funnel: **Opened, Started**.
12. **Completion by variant over time**; variant 7-day sparkline.
13. **Follow-up messages to completers**; the "Completed" audience; `{first_name}` and preview in task updates; **delivery or open stats for task updates**; "Completed after" on reminders; audience estimates.
14. General update **"Seen by"** counts.
15. Task **Activity** tab edits and actors; "Created by / Last edited by" names; one-call Duplicate.
16. Forms: **Published / Draft changes / Never published** status; **publish step and draft**; version ordinal "vN"; version **author**.
17. Builder field types: Signature, Member picker, Group picker, Audio note, Address, Date and time, Rating, Callout.

## Summary

Most of the prototype holds up. The core lists can be built from today's API: tasks with their status, phases, member-action window, reach and completion; the inbox, including live typing; queue counts; scheduled jobs; reminders; responses; variants' totals; the form schema. Much of the rest derives on the client, and some of that needs the same bulk fetches today's admin already makes (all users joined with tags, groups and action relations; daily-stats differences for weekly charts).

The invented data falls into a few groups:
- **Metadata that doesn't exist:** project colour, description and lead; suite status, rhythm and creator. Derive suite status from its tasks, give projects a colour derived from their id, and drop the rest.
- **Engagement measures the server doesn't record:** last active, active this week, opened and started stages, per-variant trends, delivery stats for task updates, "seen by".
- **A publishing model the server doesn't have:** form drafts, publish and version status; follow-up messages; audience estimates.
- **An organisation-wide live activity feed.**

Build agents should drop the N items or swap in the named closest data, rather than copy these screens as drawn.

**One correction to the prototype's `NOTES.md`:** typing presence in the inbox *is* provided, by the `/mms-threads` socket's `Composing` event.

