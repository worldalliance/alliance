# Members and texting: functionality inventory

Read from the code at c722280863. This inventory is the checklist the redesign is verified against, so that nothing staff can do today is lost. It was written against the prototype's page map before the corrections in this directory's `PLACES.md`: a `PLACES.md:<line>` citation refers to that earlier version, and where a note here says the map lacks something or adds something new, `PLACES.md` is the current answer.

Scope: `/members`, `/member/:userId`, `/members/tags`, `/member-lists`, `/member-lists/:listId`, `/groups`, `/groups/:id` (with group assignment), `/clusters`, `/friend-graph`, `/member-map`, `/away`, `/staff-directory`, `/welcome-queue`, `/needs-reply`, `/texts`, `/texts/:threadId` (with live websocket updates and the composing indicator).

Routes come from `apps/admin/src/routes.ts:27-80`. All of them sit inside `sidebar.tsx`, which mounts `MmsThreadsLiveProvider` (`apps/admin/src/sidebar.tsx:126-130`). The sidebar also drives two badges that belong to this group: Needs reply (`useNeedsReplyCount`, `sidebar.tsx:29`) and Groups (the count of members awaiting a group, `sidebar.tsx:27-28,81`). Paths below are relative to `apps/admin/src/` unless they start with `sharedweb/`, `shared/` or `common/`.

## Cross-cutting pieces

**Sidebar entries and badges** (`components/adminNavEntries.tsx:157-193`): Members, Needs reply (badge = `needsReplyCount`), Texts, Groups (badge = `groupAssignmentCount`), and a "Community" folder holding Welcome Queue, Staff Directory, Member Map, Away Members, Clusters and Friend Graph. Member lists sits in another folder (`adminNavEntries.tsx:85`). A badge shows "!" when its count is null, meaning it failed to load (`components/SidebarNav.tsx:25`), and is formatted with `shared/lib/badgeCount`. When the Needs reply list has never loaded, its count is null; after that, a failed poll keeps the last count (`lib/useTextThreadsAdmin.ts:51-57`).

**Admin search** (`components/AdminSearch.tsx`, `lib/adminSearch.ts:117-146`) finds members by name, or by an exact id, showing their email as detail, and opens `/member/:userId`. It finds groups by name and opens `/groups/:id`.

**Live texting** (`lib/mmsThreadsLive.tsx`):
- One socket.io connection per tab, to `/mms-threads` (`connectMessagingSocket`, `mmsThreadsLive.tsx:165-193`). It connects once the signed-in admin is known and refreshes the session token through `refreshSession`.
- On every connect or reconnect it refetches every member and number thread, Needs reply, and the Texts list (`:137-146`).
- On disconnect it marks itself offline and clears the composers (`:147-150`).
- A `ThreadChanged` push refetches the Texts list, throttled to once per 5 s (`LIST_REFETCH_MS`, `:59`). It refetches Needs reply only when `needsReplyChanged` is set, with the same throttle. It refetches the thread queries that show that phone number, plus thread queries with no data yet, unless the server refused them (`:99-116,156-161`).
- In a hidden tab, queries are only marked stale and refetch when the tab is shown (`refetchType`, `:68`). A change that arrives while a fetch is in flight triggers exactly one more fetch after it settles (`:65-90`).
- A `Composing` push sets the list of other admins composing, leaving out the signed-in admin (`:151-155`). A malformed push throws, because it is parsed with zod.
- `reportComposing` sends a volatile `Composing` emit and `stopComposing` sends `StoppedComposing` (`:197-209`).
- **Polling:** while the socket is connected, every thread query polls only every 60 s as a backstop. While it is disconnected, member and number threads poll every 10 s, and Needs reply polls every 30 s (`useTextThreadsAdmin.ts:32-49,228-232`, `useMemberTextsAdmin.ts:32`).

**Composing reports** (`lib/useReportComposing.ts`): the composer reports on its first non-blank edit, then at most once a second while edits continue. It stops when the draft empties or the composer unmounts. It doesn't report a draft untouched for longer than `COMPOSING_TTL_MS` (10 s, `common/src/mmsThreads.ts:24`) after a reconnect. A draft written before the socket connected is reported once it connects.

**Composing indicator** (`components/texts/ComposingNotice.tsx`): reads "Ada is replying…" or "Ada and Sam are replying…", using `Intl.ListFormat`. In the composer it is a `role="status"` region that stays mounted while empty. In list rows it renders only while someone is replying, with no announcement.

**Thread view, shared by the member page and `/texts/:threadId`**: `components/texts/TextThreadSection.tsx`, `TextHistory.tsx`, `TextComposer.tsx`, `lib/useOlderTexts.ts`, `lib/memberTexts.ts` and `useThreadActions` (`lib/useTextThreadsAdmin.ts:83-210`). Its capabilities are listed once, under `/texts/:threadId`, and referenced from `/member/:userId`.

---

## `/members`: Members list

- **New place:** Members › People › All (`#/members`, rail: Members). The member record opens as a side peek, with Open for the full page.
- **Purpose:** browse, filter and search every member, with their task progress, and tag them.
- **Page:** `pages/UsersList.tsx`

**Capabilities**
1. A search box, autofocused, placeholder "Search by name, email, or phone...". It matches name, email or the raw phone string as substrings, case-insensitive, and also matches on phone digits alone, so "555 0102000" finds "+1 (555) 010-2000" (`UsersList.tsx:253-260`, `lib/memberSearch.ts`, `common/phone` `phoneSearchTerm`/`phoneSearchDigits`).
2. A **Roles** multi-select filter, with options Admin and Staff, each showing a member count. It matches a member who has any selected role (`UsersList.tsx:262-272`, `lib/memberRoleFilter.ts`).
3. A **Tags** multi-select filter listing every tag with its member count. It matches a member who has any selected tag (`UsersList.tsx:273-283`).
4. The filter button label reads "All roles"/"All tags", then the single selected label, then "N roles"/"N tags". Each dropdown has a Clear link, shows "No tags yet" when empty, and closes on an outside click (`components/MemberFilterDropdown.tsx:31-34,57-63,86-89`).
5. A **Reset filters** link appears only while search, roles or tags is active, and clears all three (`UsersList.tsx:138-147,286-294`).
6. A **Manage tags** link to `/members/tags` (`UsersList.tsx:295-300`).
7. **Default sort** is by total time spent, descending, from the analytics endpoint. If that fails to load, an alert says "Unable to load time spent, so members aren't sorted by it." and the server order stays (`UsersList.tsx:71-77,335-342`).
8. A **Shuffle** button randomly reorders the current filtered set, using a seeded shuffle. Changing any filter clears the shuffle. While shuffled, the table's own sort is turned off (`UsersList.tsx:116-130,303-310,398`).
9. A **view switch** between Table (default) and Card, stored in the URL as `?viewMode=rows|cards` (`UsersList.tsx:66-67,311-332`).
10. **Table view** uses the shared `CommunityMembersTable` (`sharedweb/ui/CommunityMembersTable.tsx`), paged at 50 members (`UsersList.tsx:383-401`):
    - Columns: Name (avatar, display name with staff, ambassador and lead decorations, greyed with " (away)" while currently away), Action history (progress pills for every non-planned action), Contact time (the member's preferred reminder time in the leader's zone, or "Anytime"), and Next task due (green when nothing is due) (`sharedweb/ui/CommunityMemberTableRow.tsx:108-169`).
    - A **contract filter** dropdown: All, Signed (the default), Suspended, Not signed, each with a count (`CommunityMembersTable.tsx:69-71,270-282`).
    - A **completion filter**: Any status, Caught up, Not caught up, each with a count (`:283-293`).
    - Its own Reset filters link (`:294-302`).
    - Default order is by next task due (`sortMembersByNextTaskDue`), unless the list is shuffled (`:135-150`). The row deadline display recomputes when the next deadline passes (`useOnNextDeadline`).
    - A pager with "N members" (`:350-361`). The page resets when the member set changes, but not on a background refetch (`:152-162`).
    - Clicking a row **expands** it to show email, phone (formatted) and time zone, each with "Not provided" and an info tooltip. It also shows contact time in the member's zone and in yours, and the current or upcoming away ranges with reason and note, the current one marked (`CommunityMemberTableRow.tsx:171-273`).
    - The name links to `/member/:id`.
11. **Card view** shows a grid of `UserCard`s, paged at 50 with "N members" and `Pagination`. The page resets on a new search, tag filter or shuffle, but not on a refetch (`UsersList.tsx:184-205,348-381`). Note: the role filter isn't in that reset list (`:190`).
12. **UserCard** (`components/UserCard.tsx`):
    - Avatar and a name link to `/member/:id`.
    - "Contract status: Signed / Suspended / Not signed", coloured.
    - Tag badges.
    - A **Manage** dropdown of every tag, sorted by name with descriptions, as checkboxes. Checking adds the member to the tag and unchecking removes them. A checkbox is disabled while its own change is pending. "No tags available" shows when there are none (`UserCard.tsx:102-176`).
    - When there are actions: progress pills, and a **Show details/Hide details** toggle listing each action with its pill label, action status and withdrawal details (option label and decline reason) (`:177-236`).
13. **Tag add or remove** from a card: if the change fails, an inline "Failed to update tag membership. Try again." shows (`UsersList.tsx:222-248,343-347`).

**Data**
- `useUsersAdmin` → `userListAdmin` (GET `/user/list`)
- `useTimeSpentPerUserTotalAdmin` (GET `/analytics/time-spent-per-user-total`)
- `useTagsAdmin` → `userTagGetTagsAdmin` (GET `/user/tags`), `userTagAddUserToTagAdmin`, `userTagRemoveUserFromTagAdmin` (POST `/user/tags/:tagId/addUser|removeUser`). Each mutation invalidates the tag list (`lib/useTagsAdmin.ts`).
- `useActionRelationsAdmin` → `actionsActionRelationsAdmin` (GET `/actions/action-relations`)
- `useMemberContactInfoAdmin` → `communityGetAllMemberContactInfoAdmin` (GET `/community/memberContactInfo`)
- `useCompletedAllActiveActions` (local derivation)

**Shared code**
- `sharedweb/ui/CommunityMembersTable`, `CommunityMemberTableRow`, `Pagination`, `UserProgressPills` (+ `useMaxActionsPerWeek`, `PILL_STATUS_DATA`), `Avatar`, `Badge`, `Card`, `DropdownSelect`, `InfoTooltip`, `UserDisplayName`, `sharedweb/lib/useOutsideClick`
- `shared/forms/randomutils` `shuffleWithSeed`, `shared/lib/communityMemberActions`, `useOnNextDeadline`, `useAwayRanges`, `awayRangesFormatters`, `formatNextTaskDue`
- `common/plural`, `common/phone`, `common/actionActivity`

**Tests:** `pages/UsersList.test.tsx`. Beyond the list above, it asserts the following:
- Role options show "N member(s)" counts (`:141-163`).
- A 500 on the time-spent endpoint keeps the server order (`:126-139`).
- The table shows only signed members by default (`:288-301`).
- Card paging: 51 members gives a second page, and a new search returns to page 1 (`:272-286`).

**Notes**
- `UserCard.tsx:200-202` reads `relationByActionId[action.id].status` without a guard. An action the member has no relation for would crash "Show details". The same pattern appears in `UserActionsSection.tsx:49-51`.
- The search, role and tag filters are local state, not in the URL. Only `viewMode` is in the URL, and switching views resets the rest of the query string (`setParams({ viewMode })`).
- The expanded row's "Remove" button never shows here, because no `onRemoveMember` is passed.
- `CommunityMembersTable` is also the member table on `/groups/:id` and in the frontend's group view.

---

## `/member/:userId`: Member record

- **New place:** Members › People, member record (a side peek from People, Inbox and Responses; Open for the full page).
- **Purpose:** see and manage everything about one member: contact details, texts, actions, notifications, groups, roles, tags, away periods, contract, and account deletion.
- **Page:** `pages/UserDetailView.tsx`

**Capabilities: page shell**
1. The route loader rejects a non-numeric id, throwing "Not found". It also prefetches the member detail, action relations, tag summaries, friends, notifications and form responses (`UserDetailView.tsx:39-57`).
2. Load states: "Loading member...", "Failed to load member", and "Member not found" on a 404. A 404 on refetch replaces a cached member who has since been deleted (`:59-81`).
3. A failed refetch keeps the cached member and shows "Could not refresh this member. Reload to see the latest." (`SectionRefreshError`, `:149`, `components/user-detail/SectionQueryState.tsx`).

**Capabilities: header** (`UserDetailView.tsx:150-214`)

4. Huge avatar, name, coloured contract status (Signed / Suspended / Not signed), and an **Away** badge while the member is currently away.
5. **Log in as user** opens `${apiUrl}/auth/impersonate/:id` in a new tab (`:164-173`).
6. **Suspend contract** is disabled without an active contract, with a tooltip explaining why. It asks for confirmation: "Suspend {name}'s contract and remove them from their current groups?". It shows "Suspending..." while pending, a success toast afterwards, and an inline refusal message on failure (`:125-145,174-186`).
7. **Delete account** opens `DeleteAccountModal` (`components/DeleteAccountModal.tsx`):
    - Explanatory copy.
    - A required **Reason** field, posted to Slack and not stored.
    - An optional **screenshot upload**, an image sent as a data URL to `imagesUploadImage`. It shows "Uploading…" and a removable file chip, and gives its own refusal message if the upload fails.
    - A **typed confirmation**: the member's email, compared case- and whitespace-insensitively, showing "Does not match {email}" while it differs.
    - Delete stays disabled until the reason and email are given and no upload or delete is running.
    - The modal doesn't close on a backdrop click and has no close button. Dismissing is disabled while deleting.
    - On success: a toast "Account deleted", navigation to `/members`, and a refetch of every query (`useUserDetailAdmin.ts:72-82`).
8. Email, formatted phone and "ID: n".

**Capabilities: left column**

9. **Texts** (`components/user-detail/MemberTextsSection.tsx`) holds the member's own thread, with every thread capability listed under `/texts/:threadId`, plus these differences:
    - The empty state reads "No texts with this member yet." or "No phone number on file, so this member can't be texted."
    - With no phone number there is no composer. An invalid number gives the notice "This member's phone number isn't valid, so they can't be texted."
    - The composer is keyed to the member, so moving to another member starts a fresh draft. It uses the member's own time zone.
    - Once a thread exists, a link "Open this number's thread" goes to `/texts/:threadId`. The link appears after the first send creates the thread.
10. **Actions table** (`components/user-detail/UserActionsSection.tsx`):
    - Columns: Action (links to `/actions/:id`), Status (humanized), User Status (pill label; a "won't complete" status opens a hover card with withdrawal details), Last Activity (date, or —), and Actions.
    - The **+ Activity** select (`components/CreateActivityControls.tsx`) records "Completed" or "Won't complete" for the member on that action through `actionsCreateActivityAdmin`, then refetches.
    - Shows "No actions tracked." when empty.
11. **Notifications** (`components/user-detail/UserNotificationsSection.tsx`) shows three panes, with "Notifications (n)" in the heading:
    - **Texts**, newest first: status coloured green/red/amber, date, a body excerpt, and "Link clicked {time}, {duration} after sending" (or just "Link clicked" when no time was recorded). The header shows the click-rate %.
    - **Emails**: status, date, recipient, link-click label, click-rate %. Clicking a row expands a sandboxed iframe preview of the rendered HTML.
    - **Push**: receipt or ticket status, date, body, error message, "Opened". The header shows the open-rate %.

**Capabilities: right column**

12. **Member info** (`components/user-detail/UserMemberInfoSection.tsx`):
    - Bio, or "No bio provided.".
    - Location: city and country, or the custom city string.
    - Invited by: a link to the inviting member, or a campaign label, with the source ("via individual single-use invite link", "via group invite link "label"", or "via {source}").
    - Public profile (shared or private), Anonymous, Email with leads, Phone with leads, Form responses preference, Reminder time with zone, Time zone, and Cluster #id (shown only when set).
13. **Notification settings** (`components/user-detail/UserNotificationSettingsSection.tsx`), read-only:
    - Each channel's default, On or Off.
    - "Overrides (n)", each with its label · channel, On/Off, its source ("Set by member", "Carried over by migration", "Off for new accounts") and "Not in effect" where it applies.
    - Otherwise "Every notification follows the defaults.". Load, refresh and error states as elsewhere.
14. **Groups move/assign** (`components/MemberGroupMoveSection.tsx`):
    - Lists the member's groups as links to `/groups/:id`, then the groups they lead with a "Leader" chip.
    - A **Move from** select appears when they're in at least one group, auto-picked when there's only one. A **Move to** (or **Assign to**) select offers only groups that accept staff assignment (`acceptsStaffAssignment`) and that they aren't already in.
    - It asks for confirmation ("Move member?" / "Assign member to group?"), then calls `communityMoveMemberAdmin` or `communityAddMemberAdmin`, refreshes the member, and shows a success toast.
    - Disabled without an active contract, with the note "An active contract is required for group membership.".
    - Messages: "No groups with staff assignments and available capacity." (only after the groups have loaded), "Moving a member does not change groups they lead.", and on a refresh failure, "Membership was updated, but the page could not refresh. Reload to see their latest groups.".
15. **Friends (n)** (`components/user-detail/UserFriendsSection.tsx`): each friend has an avatar, name and status ("Signed/Not signed · Ambassador · Leader") and links to their member page.
16. **Roles** (`components/user-detail/UserRolesSection.tsx`): checkboxes for Staff, Ambassador and Admin that save immediately. The Admin box is disabled on your own record ("You cannot change your own admin status"). A box is disabled while its own change is pending, and a refusal shows inline.
17. **Tags (n)** (`components/user-detail/UserTagsSection.tsx`): every tag summary as a checkbox, sorted, toggled immediately, with a per-tag pending state and a refusal message. After a change the member is refetched.
18. **Away Periods (n)** (`components/UserAwayPeriodsSection.tsx`):
    - A list with status Current, Upcoming or Past, each colour-coded, plus date range, reason and note.
    - **Edit** opens inline start and end dates (end ≥ start), a reason select, and a note that is required for some reasons (`isAwayRangeNoteRequired`). Saving sends only the days that changed (`changedAwayRangeDays`).
    - **Delete** asks for confirmation ("Delete {range} for {name}?").
    - A **Schedule time away** form: start no earlier than today, end ≥ start, reason, and note. Its button is disabled until valid, and it shows a toast on success.
19. **Contract**: the status, and every contract event (signed or suspended, with date), newest first.
20. **Invited Submissions (n)** (`components/user-detail/UserFormSubmissionsSection.tsx`): form responses, newest first. Each links to `/forms/:formId/responses`, labelled by the form's display slug, with its date and device type.
21. Every section has its own loading text, "Failed to load {noun}", and a mounted "Could not refresh {noun}. Reload to see the latest." status region.

**Data**
- `useUserDetailAdmin` → `userUserDetailAdmin`, `userUpdateUserRolesAdmin`, `contractSuspendContractAdmin`, `userDeleteUserAdmin`; tag membership through `useTagsAdmin`
- `useUserActionRelationsAdmin` → `actionsActionRelationsForUserAdmin`, `actionsCreateActivityAdmin`
- `useUserNotifsAndFormsAdmin` → `notifsNotifsForUserAdmin`, `tasksGetFormsForUserSidAdmin`
- `useNotificationSettingsAdmin` → `notificationSettingsGetAdmin`
- `useUserAwayRangesAdmin` → `userAwayRangeGetAwayRangeForUserAdmin`, `userAwayRangeCreateAwayRangeAdmin`, `userAwayRangeUpdateAwayRangeAdmin`, `userAwayRangeDeleteAwayRangeAdmin`
- `useCommunitiesAdmin`, `useMoveCommunityMemberAdmin`, `useChangeCommunityMembershipAdmin` (`lib/useCommunitiesAdmin.ts`)
- `shared/lib/user` `useUserFriendsQuery`/`userFriendsQuery`
- `useTagsAdmin` summaries → `userTagGetTagSummariesAdmin`
- `shared/lib/useFormsAdmin` `useFormDisplaySlugs`
- `imagesUploadImage`
- `useMemberTextsAdmin` → `mmsThreadGetThreadAdmin`, `mmsThreadSendTextAdmin`, `mmsThreadMarkOptedOutAdmin`, `mmsThreadMarkHandledAdmin`, `mmsThreadMarkNeedsReplyAdmin`
- impersonation URL `/auth/impersonate/:id`

**Shared code**
- `sharedweb/ui/Avatar`, `Button`, `ToastProvider` (confirm/success), `Modal`, `FormInput`, `Spinner`, `HoverCard`, `UserProgressPills`
- `sharedweb/lib/queryClient` `prefetchFromLoader`
- `shared/lib/hey-api` `thrownStatus`, `notificationSettings`, `awayRangesFormatters`, `dateInput`, `useAwayRanges`
- `common/awayRange`, `common/community` `acceptsStaffAssignment`, `common/phone`, `common/errorMessage`

**Tests:** `pages/UserDetailView.test.tsx` (load, 404, deleted-while-cached, refresh errors for each section, role, suspension and tag refusals, recording an activity, notification settings rendering), `components/DeleteAccountModal.test.tsx` (trimmed body; retry after refusal; upload refusals show the component's own text, not the server's), `components/MemberGroupMoveSection.test.tsx` (move, assign, reload-hint, loading vs no-capacity, refusal texts hidden behind fallbacks), `components/UserAwayPeriodsSection.test.tsx` (spinner, empty, failed load vs refetch failure, schedule, refused schedule keeps form, edit sends only changed days, delete), `components/user-detail/UserNotificationsSection.test.ts`, `SectionQueryState.test.tsx`, and `MemberTextsSection{,.conflict,.handled,.optOut,.scroll}.test.tsx`. Beyond the list above, they assert:
- A send after the page moved to another member lands in the first member's thread, and a failure names that member in a toast.
- A poll that fetched the sent text before the send answered shows it only once.

**Notes**
- Several headings break the capitalisation rule: "Member Info", "Away Periods", "Invited Submissions", and the column headers "User Status" and "Last Activity".
- `formatAwayRange` is defined in `components/UserAwayPeriodsSection.tsx:440` and imported by `/away`. A similarly named `formatAwayRange` in `shared/lib/awayRangesFormatters` is used by `CommunityMemberTableRow`. Two formatters for the same thing.
- "Invited Submissions" is really every form response the member gave. The label looks stale.
- `CreateActivityControls` swallows errors to the console, so a failed activity record shows nothing.

---

## `/members/tags`: Tags

- **New place:** Members › Tags (`#/members/tags`).
- **Purpose:** create, rename, describe and delete member tags.
- **Page:** `pages/TagManagement.tsx`

**Capabilities**
1. A list of tags sorted by name. Each card shows the name, a "N members" badge, "Public name: …" when set, and the description (pre-wrapped) (`TagManagement.tsx:113-130,244-357`).
2. **Edit** opens inline fields for Name, Public display name (optional) and Description, with Cancel and Save ("Saving..." while pending, both disabled meanwhile). Emptying the public name saves it as `null` (`:58-78,300-347`).
3. **Delete** uses a `window.confirm` reading "Delete tag "{name}"? This cannot be undone.", and shows "Deleting..." while pending (`:231-242,288-295`).
4. A **Create tag** form with Tag name and Description, both required ("Name and description are required."). The create form has no public display name field, so it always sends `null`. The button reads "Creating..." while pending, and the form clears on success (`:32-56,132-187`).
5. Errors: "Unable to create/update/delete tag. Please try again.", and "Failed to load tags. Please try again." (`:95-104`).
6. A **Back to members** link (`:109-111`).

**Data:** `useTagsAdmin` → `userTagGetTagsAdmin`, `userTagCreateTagAdmin` (POST `/user/createTag`), `userTagUpdateTagAdmin` (POST `/user/tags/:tagId/update`), `userTagDeleteTagAdmin`. Each invalidates the tags and the tag summaries.

**Shared code:** `sharedweb/ui/Badge`, `Button`, `Card`; `common/plural`.

**Tests:** `pages/TagManagement.test.tsx` covers create without a public name, which sends `null`, and clearing the public name to whitespace, which saves `null`.

**Notes**
- The loading text says "Loading groups..." (`:114`), a leftover from groups.
- The description textarea has id `group-description`, which is also used on `/groups` (`:160-165`).
- `handleCreateGroup` is misnamed.
- The page doesn't list a tag's members; you only see them through the `/members` Tags filter.

---

## `/member-lists`: Member lists

- **New place:** Members › Member lists (`#/members/lists`).
- **Purpose:** list the hand-picked member lists that formulas read through `isOnList("…")`.
- **Page:** `pages/MemberListsPage.tsx`

**Capabilities**
1. An explanation that mentions `isOnList("List name")` (`MemberListsPage.tsx:14-18`).
2. A **New list** button to `/member-lists/new` (`:20-22`).
3. A table with columns Name (links to `/member-lists/:id`) and Members (the count of `userIds`) (`:37-59`).
4. States: "Loading lists…" (status), the refusal message "Couldn't load lists.", and the empty state "No lists yet. Create one to pick members by hand for a formula." (`:24-36`).

**Data:** `useMemberListsAdmin` → `memberListsListAdmin`.

**Shared code:** `sharedweb/ui/Button`.

**Tests:** `pages/MemberListsPage.test.tsx` covers the count and link, the empty state, and the load error.

---

## `/member-lists/:listId`: Member list record, including `/member-lists/new`

- **New place:** Members › Member lists, member list record.
- **Purpose:** create or edit a list's name and members, and delete it while fixing any formulas that read it.
- **Page:** `pages/MemberListPage.tsx`

**Capabilities**
1. `listId === "new"` opens a blank editor. The editor waits for a fresh fetch of both the lists and the formulas, never cached copies, so its first save isn't a version conflict. A missing id shows "This list doesn't exist, or was deleted." with a link back (`MemberListPage.tsx:38-93`). The page is keyed on `listId`, so following a link to another list opens it fresh.
2. A breadcrumb link "Member lists", and a heading with the list name or "New list". The browser tab title is "{name} - Admin" (`:244-252`).
3. A **Name** field, max 100 characters, whose hint shows the live formula call `isOnList("name")`. "Renaming it updates them." (`:266-281`).
4. A **Members (n)** multi-select `UserSelect` over all users, with loading and failed states (`:283-292`).
5. **Add by id or email**: a textarea that splits pasted text on commas, semicolons and whitespace and matches ids or emails case-insensitively (`lib/memberEntries.ts`). The **Add members** button reads "Loading members…" while users load and is aria-disabled until they have. Matched members are added. Unmatched entries stay in the box, with the alert "This matched no member, so it wasn't added: …" (or "These N matched no member…"). Emptying the box clears the alert (`:229-240,294-342`).
6. **Save** also folds in any entries left in the paste box. It refuses if any entry is unmatched, if members failed to load ("Members couldn't load…Reload the page"), or if they are still loading ("…Save again in a moment") (`:144-200`).
7. Saving an existing list sends `baseVersionId` and `baseName`. A 409 shows the refusal with a **Reload** button (`components/formulas/SaveRefusal.tsx`, `:138-142,170-182`). A new list navigates to its new URL after saving. A "Saved." toast confirms. Members picked during a save stay, and count as unsaved (`:183-196`).
8. **Leave guard**: unsaved changes cover the name, the members, a non-blank paste box, and formula or part fixes that differ from how they opened. Leaving prompts through both the browser's beforeunload and the router blocker, with a `window.confirm` reading "You have unsaved changes. Are you sure you want to leave this page?" (`:130-136`, `lib/useUnsavedChangesPrompt.ts`).
9. Fields are read-only and buttons aria-disabled while a save is in flight (`:124,278,310,347`).
10. **Delete list** (only for a saved list) opens a destructive `ConfirmDialog`. Its message depends on whether formula fixes are pending. The delete goes through `formulasSaveAdmin` with `deletedLists: [{id, baseVersionId}]`, plus any fixes and part fixes (`:202-227,378-402`).
11. **Formula fixes on delete**: if the server refuses, the alert reads "Nothing was deleted. Fix the problems below, then delete again." and each problem formula or suite part is listed under "What reads this list" with **Fix it in this save**. That opens the formula's fields, or the part condition's fields, inline, with **Stop fixing it**. Focus moves to the fix heading on open and back to Delete on stop (`components/formulas/FormulaFixes.tsx`, `OtherFormulaProblems`, `PartFixFields`, `FormulaFields`).
12. After a successful delete: a toast "Deleted {name}.", the list is dropped from the cache, navigation to `/member-lists`, and formulas are refetched (`:212-220`).

**Data**
- `useMemberListsAdmin`, `useSaveMemberListAdmin` → `memberListsCreateAdmin` / `memberListsUpdateAdmin`, which invalidate the lists and formulas
- `useForgetMemberListAdmin`
- `useFormulasAdmin` → `formulasListAdmin`, `useSaveFormulasAdmin` → `formulasSaveAdmin`, `useInvalidateFormulasAdmin`
- `useUsersAdmin`

**Shared code:** `sharedweb/ui/UserSelect`, `Button`, `ToastProvider`; `shared/lib/hey-api` `thrownStatus`; the formula editor components from the formulas pages (`components/formulas/*`, `lib/formulaDraft`).

**Tests:** `pages/MemberListPage.test.tsx` covers paste with unmatched entries, a conflict with Reload, saving leftover paste-box entries, keeping members removed during a save, clearing the unmatched alert, delete with formula and part fixes, the leave prompt for a changed part fix, opening on fresh rather than cached formulas, and refusing paste-box entries when users failed to load.

**Notes**
- The formula-fix flow is shared with the formulas pages. A redesign that moves member lists must keep it, or a list that a formula reads can't be deleted.

---

## `/groups`: Groups, with group assignment

- **New place:** Members › Groups › All groups. Members awaiting a group are its second tab, Awaiting assignment, which has its own rail queue "Awaiting a group · count".
- **Purpose:** list and create groups, and assign members who are waiting for a group.
- **Page:** `pages/GroupsPage.tsx`

**Capabilities: group list**
1. Heading and subtitle (`GroupsPage.tsx:146-153`).
2. An **Unused capacity** card: the sum of free slots over groups that have a max capacity, minus members awaiting assignment, never below 0. It shows only after the list loads without error (`:92-102,155-166`).
3. Groups sorted by trimmed name, case-insensitive. Each row links to `/groups/:id` and shows name, description (or "No description yet."), Public or Private, "N leaders" when that isn't exactly 1, and member count. With pending assignment selections it shows "(+n)". With staff assignment on it shows "/ capacity", greyed when free slots ≤ pending (`:384-438`).
4. States: "Loading groups…", the refusal message "Unable to load communities. Please try again.", and "No groups yet.". It keeps loading while offline rather than saying there are none (test).
5. A **Create group** form (`:189-374`):
    - Name and Description, each with maxLength and `CharacterLimitNotice`.
    - Checkboxes for **Public**, **Allow member invites** and **Allow staff assignments**, with copy from `shared/lib/copy` `groupSettings`. Checking Public forces both of the others on and disables them.
    - **Max capacity**, a number ≥ 1, shown only when `isMaxCapacityRequired`.
    - Validated by `validateCommunitySettings`, with inline errors. "Creating…" while pending. The new group is added to the cache and the form clears.

**Capabilities: group assignment panel** (`components/GroupAssignmentPanel.tsx`, shown only while someone awaits assignment, `GroupsPage.tsx:138-143`)

6. A load error for the queue: "Unable to load members awaiting group assignment. Please try again." (`GroupsPage.tsx:130-137`).
7. Each waiting member row shows an avatar, a name link to `/member/:id`, email · formatted phone, and current non-led groups as buttons to `/groups/:id?from=groups` (or "No current group").
8. A **New group** select per member. It offers only groups with staff assignments on and a max capacity, and with free slots greater than the selections already pending for that group; a group already selected stays offered. It reads "Loading groups..." while loading (`:253-281`).
9. Per-row warnings "Over capacity by n." and "This group is not available for assignment.", and a **View group** button for the selected group (`:449-475`).
10. **Selections persist in localStorage** under `admin.groupAssignmentSelections`. They survive reloads, are pruned to members still waiting, and are removed once assigned (`:21,50-103,319-332`).
11. Selections feed back to the group list as "(+n)" (`onSelectionCountsChange`).
12. **Confirm assignments** is disabled unless at least one selection exists, the groups have loaded, nothing is over capacity, and nothing is invalid. Clicking it while blocked shows "Select at least one group assignment before confirming." It opens a `ConfirmDialog` reading "You're about to assign N members:" with one line per member, "Name: (Remove from: A, B) -> New group" (`:186-251,283-296,223-244`).
13. Submitting calls `userGroupAssignmentAssignGroupsAdmin` with the whole batch. Assigned members leave the queue. On error the queue refetches, since the batch may be partly applied, and the groups refetch either way. Refusals show inline (`lib/useGroupAssignmentAdmin.ts:28-49`, panel `:298-345`).
14. The panel closes once its last member is assigned (test).

**Data**
- `useCommunitiesAdmin` → `communityGetCommunitiesAdmin`
- `useCreateCommunityAdmin` → `communityCreateCommunityAdmin`
- `useGroupAssignmentMembersAdmin` → `userGroupAssignmentGetGroupAssignmentMembersAdmin`
- `useAssignGroupsAdmin` → `userGroupAssignmentAssignGroupsAdmin`

**Shared code:** `common/community` (`freeSlots`, `getMemberCount`, `isMaxCapacityRequired`, `validateCommunitySettings`, length limits), `shared/lib/constants` `NEW_COMMUNITY_SETTINGS`, `shared/lib/copy` `groupSettings`, `sharedweb/ui/Button`, `Card`, `CharacterLimitNotice`, `List`, `Avatar`; `components/ConfirmDialog`.

**Tests:** `pages/GroupsPage.test.tsx` (list and capacity, load failure, create, refusal, offline, empty description, queue failure, panel closes) and `components/GroupAssignmentPanel.test.tsx` (groups offered once loaded, load failure and refusal, assign removes from the queue and refreshes, refusal keeps the queue, keeps groups when the post-assign refetch fails, blocks over-capacity).

**Notes**
- `?from=groups` is appended to group links, but `GroupDetailPage` never reads it. Dead.
- Selections in localStorage are per browser, not per admin, and aren't shared across admins.
- The page calls groups "communities" in its error copy.

---

## `/groups/:id`: Group record

- **New place:** Members › Groups, group record.
- **Purpose:** edit a group's settings, manage its members and leaders, see member progress, and delete the group.
- **Page:** `pages/GroupDetailPage.tsx`

**Capabilities**
1. The group is found in the cached communities list. A non-numeric id shows "Invalid community id." at once. "Loading community…" holds while the list is pending, or while a refetch for a group missing from the cached list is in flight (also offline). "Community not found." and refusal messages show otherwise, each with "← Back to Groups" (`GroupDetailPage.tsx:16-35,84-109`).
2. Header: back link, name, subtitle, and **Delete group**, which opens a full-screen confirm reading "Delete {name}?" and "All members and leaders will lose this community assignment. This action cannot be undone.", labelled "Delete community". It shows "Deleting…". On success it shows a toast and navigates to `/groups`, without flashing "not found". On failure it shows an inline refusal and a toast (`:52-82,111-130`).
3. **Settings form** (`components/group-detail/GroupSettingsForm.tsx`):
    - The same fields and Public coupling as create.
    - Capacity may go **below the current member count** (`memberCount: null`, `:77-82`).
    - Saving shows "Saving…", then a "Group updated" toast.
    - A refetch reseeds the form only while it is untouched, so it never overwrites unsaved edits (`:41-62`).
4. **Members card** (`components/group-detail/GroupMembership.tsx:99-191`):
    - "N members".
    - An **Add member** single `UserSelect` over all users, with an Add button ("Adding…"). The picker clears on success.
    - The member list, sorted, with a "Leader" tag where it applies, **Make leader** (a popover confirm, "Promote {name} to a leader of {group}?") and **Remove**, which has no confirmation. Each shows a per-member pending state.
5. **Leaders card** (`:193-261`): "N total leaders", an **Add leader** `UserSelect` with a button, and **Remove leader** per leader. Empty states: "No members yet. Add someone above." and "No leaders yet. Promote a member or add directly.".
6. Every membership change refetches the group's member info (`useGroupMembershipChanges.ts:156`). Failures show inline and as a toast (`reportError`, `GroupDetailPage.tsx:43-50`).
7. A **member progress table**: `CommunityMembersTable` with a Leads section and a Members section, the contract and completion filters, progress pills, contact time, next task due, and expandable contact and away details (as in `/members`, item 10, but unpaged). Errors loading member details or contact info show "Unable to load member details. Please try again." (`GroupMembership.tsx:263-284`).

**Data**
- `useCommunitiesAdmin`, `useUpdateCommunityAdmin` → `communityUpdate`
- `useDeleteCommunityAdmin` → `communityDeleteAdmin`
- `useChangeCommunityMembershipAdmin` → `communityAddMemberAdmin` / `communityRemoveMemberAdmin` / `communityAddLeaderAdmin` / `communityRemoveLeaderAdmin`
- `useCommunityMemberInfoAdmin` → `actionsGetCommunityMemberInfoAdmin`, `communityGetMemberContactInfoAdmin`
- `useUsersAdmin`
- `useRefusalToast`

**Shared code:** `sharedweb/ui/CommunityMembersTable`, `UserSelect`, `CharacterLimitNotice`, `ToastProvider` (`ConfirmMode.Fullscreen` / `Popover`), `UserProgressPills`; `common/community`; `shared/lib/useCommunityMemberContactInfo`.

**Tests:** `pages/GroupDetailPage.test.tsx`: 25 cases, all reflected above. Note especially "never says a just-deleted group is missing", "keeps unsaved details when the group refetches", and "shows the action's fallback when a write never reaches the server".

**Notes**
- Removing a member or leader has **no confirmation**, unlike delete and make-leader.
- The progress table is given `communityId` but no `onRemoveMember`, so its expanded-row Remove never renders. That path is dead here.
- The `"promote-leader"` and `"add-leader"` actions both call `AddLeader`.
- The copy mixes "community" and "group".

---

## `/clusters`: Clusters

- **New place:** Members › Clusters (`#/members/clusters`).
- **Purpose:** view and rename the friend-disjoint introduction clusters of signed members, and export each member's clustermates.
- **Page:** `pages/ClustersPage.tsx`

**Capabilities**
1. A summary card: "N clusters" and "N members placed" (`ClustersPage.tsx:92-103`).
2. A card per cluster: display name, "N members", and member chips (avatar and name) linking to `/member/:id`. An empty cluster shows "No members" (`:163-233`).
3. **Rename**: the pencil opens an inline input (autofocused) with Save and Cancel. **Enter saves and Escape cancels.** A blank or unchanged name cancels. It shows "Saving…". A refusal shows as a toast and the editor stays open. The cache is patched only after the server accepts, cancelling any in-flight refetch (`:144-210`, `lib/useClustersAdmin.ts:16-40`).
4. **Export clustermates** copies a JSON object to the clipboard. It maps each user id to markdown: "The other members of your introduction group ({cluster}) are:" followed by a list of `[name](profile URL)` sorted by id, or "You are the only member…". Names are markdown-escaped. A toast shows "Copied clustermates for N users to clipboard." or "Could not copy to clipboard.". The button is disabled with no clusters (`:34-65,79-86`).
5. States: "Loading clusters…", "No clusters yet.", "Unable to load clusters." (or the session-expired message on a 401), and the loaded list kept beside a refetch error (`:21-29,90,105-115`).
6. The browser tab title is "Clusters - Admin".

**Data:** `useClustersAdmin` → `clusterListAdmin`; `useRenameClusterAdmin` → `clusterUpdateAdmin`; `lib/config` `memberProfileUrl`.

**Shared code:** `sharedweb/lib/clipboard` `copyToClipboard`, `sharedweb/ui/Avatar`, `Button`, `Card`, `ToastProvider`; `shared/lib/hey-api` `thrownRefusalMessage`.

**Tests:** `pages/ClustersPage.test.tsx` covers the list, a single fetch, a failed load, 401 copy, refetch error, rename accepted, rename refused and kept open, and a 401 on rename.

**Notes:** the export is the only way staff get clustermate text for messaging. It is easy to miss in a redesign.

---

## `/friend-graph`: Friend graph

- **New place:** Members › Friend graph (`#/members/friends`).
- **Purpose:** explore friendships among members with an active contract as a force-directed graph.
- **Page:** `pages/FriendGraphPage.tsx`

**Capabilities**
1. Nodes are members with an active contract (profile picture, or a "?" glyph, labelled with `publicDisplayName`). Edges are friendships, de-duplicated as undirected (`FriendGraphPage.tsx:59-104`).
2. A header with "N members with an active contract, M friendships" and, while filtered, "— K matching filters" (`:180-187`).
3. **Filters**: Role (All, Admin, Staff, Regular), Community (built from members' groups) and Tag (built from members' tags). Non-matching nodes and their edges fade to near-transparent rather than being hidden. A **Reset filters** link appears while any filter is set (`components/force-graph/UserGraphFilters.tsx`, `:195-220`).
4. A **Spread** slider from 20 to 800, step 10, default 120, that sets the charge strength live (`:198-209`).
5. **Graph interaction** (`components/force-graph/ForceGraph.tsx`): zoom and pan (0.2×–4×), drag a node, and click a node to select it, which highlights the node and its direct friends and their edges in blue. Click it again or click the background to deselect. A hover title shows the name. The layout is pre-warmed for 500 ticks.
6. The graph doesn't refetch on window focus or reconnect, so the layout and selection hold (`KEEP_LAYOUT`). It waits for a fresh fetch after mounting before drawing anything cached ("Loading graph...") (`:170-176`).
7. A failed load shows the banner "Could not load users, friendships. The graph below is incomplete.", and draws no cached friendships once their reload fails (`components/FailedLoadsBanner.tsx`, `:45-57`).

**Data:** `useGraphUsersAdmin` → `userListForGraphAdmin`; `useFriendGraphEdgesAdmin` → `userFriendGetFriendGraphEdgesAdmin`.

**Shared code:** `common/displayName`; d3 (local `ForceGraph`).

**Tests:** `pages/FriendGraphPage.test.tsx` (highlight, user and friendship load failures, waiting for fresh lists), `components/force-graph/ForceGraph.test.tsx`, `UserGraphFilters.test.tsx`.

**Notes:** `ForceGraph` and `UserGraphFilters` are shared with `/invites/graph` (Growth area). The heading "Friend Graph" breaks the capitalisation rule.

---

## `/member-map`: Member map

- **New place:** Members › People › Map layout (`#/members`).
- **Purpose:** show where members are concentrated on a world map, with location coverage stats.
- **Page:** `pages/MemberMapPage.tsx`

**Capabilities**
1. A Mercator world map (`react-simple-maps`, with country shapes from a CDN, `world-atlas@2`). There is one marker per city with coordinates; its radius and colour scale with count, from light red through orange to dark red (`chroma-js`) (`MemberMapPage.tsx:27,103-186`).
2. An intensity legend from Fewer to More (`:187-198`).
3. A **Location coverage** card: Members with location, Total members, Non-US members, Non-US percentage (of those with a location, or "—"), and Distinct locations (`:203-251`).
4. **Top regions**: the 12 cities with the most members, each with "N members" (`:253-272`).
5. States: "Loading locations…", the refusal message "Unable to load member locations. Please try again later.", and "No member location data available yet." (only when there's no error) (`:129-142`).

**Data:** `useUserCityCountsAdmin` → `userCityCountsAdmin`.

**Shared code:** `sharedweb/ui/Card`; `common/plural`.

**Tests:** `pages/MemberMapPage.test.tsx` checks the summary counts, and that a failed load shows the error rather than zeros or the no-data message.

**Notes**
- The map isn't interactive: no tooltips, no zoom, and no click-through to the members in a city.
- PLACES.md makes it a "Map layout" of People, but today it is aggregate-only, not a layout of the member list.
- The page depends on an external CDN.

---

## `/away`: Away members

- **New place:** Members › People › Away (`#/members`).
- **Purpose:** list members who are away at any point in a chosen time window.
- **Page:** `pages/AwayMembersPage.tsx`

**Capabilities**
1. **From** and **Through** date-time pickers. The default window runs from the next Tuesday at 7pm (today, if today is Tuesday in Pacific time) through the following Tuesday at 11:59pm, Pacific (`AwayMembersPage.tsx:13-22`, `lib/launchTimeZone`). Each picker shows the chosen time in the launch zone underneath (`inLaunchZone`, `:46-48`).
2. Validation: "Pick a start before the end." hides the results (`:28,52-54`).
3. A count line: "N members away at some point in this window." (distinct users) (`:62-65`).
4. A table with columns Member (links to `/member/:id`), Away (date range), Reason and Note (`:66-96`).
5. Error: the refusal message "Couldn't load away periods." (`:55-59`).

**Data:** `useAwayRangesInWindowAdmin` → `userAwayRangeGetAwayRangesInWindowAdmin` (query key includes from and to).

**Shared code:** `sharedweb/ui/DateTimePicker`, `shared/lib/awayRangesFormatters` `formatAwayReason`, `@date-fns/tz`.

**Tests:** `pages/AwayMembersPage.test.tsx` covers the default window, start-before-end, and the Tuesday-today case.

**Notes**
- The window isn't stored in the URL.
- No editing happens here; edits go through the member record.
- `formatAwayRange` is imported from a component file (`components/UserAwayPeriodsSection.tsx`).

---

## `/staff-directory`: Staff directory

- **New place:** Members › People › Staff (`#/members`).
- **Purpose:** order the people with the staff flag for the public People page, and set each one's title and About link.
- **Page:** `pages/StaffDirectoryPage.tsx`

**Capabilities**
1. A list of staff in display order: drag handle, picture, a name link to `/member/:id`, a **Brief title** input and an **About link (optional)** input (`StaffDirectoryPage.tsx:151-232`).
2. **Drag to reorder**, with a green bar showing the drop position before or after the target, and the dragged row dimmed (`lib/useDragReorder.ts`, `:34-45,157-182`).
3. **Save** is disabled with "No changes to save" until the order, a title or a link differs from what was saved, and reads "Saving…" while pending. It sends every item with a new `staffDisplayOrder` (`:47-60,111-134`). On success the edits clear and the saved data is stored. On failure a toast "Failed to save staff directory" shows and the edits are kept.
4. A **content check before saving** (`components/useContentConfirm.tsx`): if a title or link mentions "worldalliance", or a link is an absolute URL to the Alliance site, a "Save anyway?" dialog lists the excerpts with guidance (use paths; use thealliance.org). It saves only on **Save anyway** (`:115-126`).
5. Explanatory copy linking to `/members`. Staff are added or removed by toggling Staff on a member's record (`:137-145`).
6. States: "Loading...", a load error (session-expired copy on a 401), the loaded list kept beside a refetch error, and "No staff members yet. Mark someone as staff on their member page." The browser tab title is "Staff Directory - Admin".

**Data:** `useStaffDirectoryAdmin` → `userStaffDirectoryAdmin` (GET `/user/staff-directory-admin`); `useSaveStaffDirectoryAdmin` → `userUpdateStaffDirectoryAdmin` (PUT, same path).

**Shared code:** `sharedweb/ui/Button`, `ToastProvider`; `common/url` `isAllianceAppHostname`; `components/ConfirmDialog`.

**Tests:** `pages/StaffDirectoryPage.test.tsx` covers saving a title, keeping edits when a save fails, saving a reorder, load failure, refetch error, 401, the worldalliance prompt for title and link, and the absolute-site-link prompt (paths and titles aren't flagged).

**Notes**
- **No leave guard** for unsaved edits, unlike member lists.
- **No keyboard reordering**: dragging is mouse-only (an accessibility gap the redesign could fix).
- An empty input saves as `null`.

---

## `/welcome-queue`: Welcome queue

- **New place:** Members › Welcome queue (`#/members/welcome`, its own rail queue "Welcome queue · count").
- **Purpose:** list newly onboarded members who haven't had a staff welcome comment yet, linking to where staff leave one.
- **Page:** `pages/WelcomeQueuePage.tsx`

**Capabilities**
1. An explanation of who is listed: members who have signed, completed all required onboarding tasks that apply to them, and have no staff comment on any onboarding completion (`WelcomeQueuePage.tsx:70-77`).
2. A count line, "N member(s) need(s) a welcome", for the current filter (`:87-91`).
3. A **filter switch**: All (n) and Staff liked (n), where Staff liked means `staffLikeCount > 0`. The filter is local state, not in the URL (`:30,46-65,92-115`).
4. A table in the server's order, with columns Member (avatar, link to `/member/:id`, "ID: n"), Completed (date and time), Staff Likes (count), and Links: **Leave welcome comment**, which opens the frontend activity page in a new tab, `${siteUrl}/actions/:actionId/activity/:activityId#comments`, plus "Activity #id" (`:21-25,124-197`).
5. States:
    - "Loading members..." in the count line and as a table row.
    - "No completions match this filter."
    - "No active required onboarding tasks are configured." when `requiredActionCount === 0`. In that case the page doesn't claim nobody needs a welcome.
    - On error, "Unable to load members who need welcomes." (session-expired copy on a 401). The queue is hidden if it never loaded, and kept beside the error if it had.
6. The browser tab title is "Welcome Queue - Admin".

**Data:** `useWelcomeQueueAdmin` → `actionsGetWelcomeQueueAdmin`; `lib/config` `getSiteUrl`.

**Shared code:** `sharedweb/ui/Avatar`; `common/plural` `pickForCount`; `shared/lib/hey-api`.

**Tests:** `pages/WelcomeQueuePage.test.tsx` covers links and server order, empty queue, missing onboarding tasks, the useful error, the fallback, and keeping the loaded queue beside an error.

**Notes**
- The welcome itself happens on the member frontend; the admin only links out.
- The rail badge count in PLACES.md doesn't exist in today's sidebar, which has no welcome-queue badge.
- The heading "Welcome Queue" and column "Staff Likes" break the capitalisation rule.

---

## `/needs-reply`: Needs reply

- **New place:** Inbox › Needs reply queue (`#/inbox`, rail: Inbox · count).
- **Purpose:** list phone numbers, members or not, with an inbound text no staff member has answered, longest waiting first.
- **Page:** `pages/NeedsReplyPage.tsx`

**Capabilities**
1. A heading with a live status, "N waiting" or "None waiting", and a mounted refresh-error status (`NeedsReplyPage.tsx:102-116`).
2. An explanation of when a number leaves the list (a reply, marked handled, opted out) and when it comes back (the reply failed, a new text, or someone marks it needs reply) (`:117-123`).
3. One row per thread, linking to `/texts/:threadId`. The row shows the contact name (member names joined, or the formatted number when no member has it), the **composing indicator** ("X is replying…", unannounced), "Waiting {distance}" (updated every minute by `useClockMinute`), and a last-text preview ("Sent an attachment" when the body is empty) (`:142-176`, `lib/memberTexts.ts:109-120`).
4. **Held rows**: while the pointer is over the list, or a row has keyboard focus (`:focus-visible` only, so not focus left behind by a click), and the tab is visible, a poll doesn't reorder rows. A number that stopped waiting stays in place, greyed, reading "No longer waiting", and new arrivals are appended below. The latest order applies once the hold ends or the tab is hidden (`:21-87`).
5. Live updates through the socket and polling (see Cross-cutting). A failed later poll keeps the list and its place.
6. States: "Loading texts…", the refusal message "Couldn't load texts needing a reply.", and "No texts are waiting for a reply.". The browser tab title is "Needs reply - Admin".
7. The sidebar badge shows the same count (see Cross-cutting).

**Data:** `useNeedsReplyAdmin` → `mmsThreadNeedsReplyThreadsAdmin`.

**Shared code:** `shared/lib/useClockMinute`; date-fns `formatDistanceToNow`.

**Tests:** `pages/NeedsReplyPage.test.tsx`: 15 cases, including every held-rows edge case (focus versus click focus, hidden tab, list emptied, pointer leave), the minute clock, and the composer name on a row. `lib/useTextThreadsAdmin.test.ts` covers the count semantics and backstop polling.

**Notes:** the held-rows behaviour is subtle and fully tested; a redesigned inbox list must keep it or lose a guard against misclicks.

---

## `/texts`: Texts (all threads)

- **New place:** Inbox › All queue (`#/inbox`).
- **Purpose:** browse every phone number that has texted the Alliance or been texted by staff, latest first, searchable by number.
- **Page:** `pages/TextsPage.tsx`

**Capabilities**
1. **Search by phone number**: a GET form that puts the search in the URL as `?search=`. It has `inputMode="tel"` and maxLength 40 (`THREAD_SEARCH_MAX_LENGTH`). A search with no digits, such as a name, is refused with "Search by the digits of a phone number." and doesn't fetch (`TextsPage.tsx:19-29,60-83`).
2. **Paging** in the URL as `?page=`, with "Newer texts" and "Older texts" links that keep the search. "Older texts" shows only when `hasMore` holds and the page shown isn't placeholder data (`:21-24,32-38,109-122`). Paging keeps the current page up while the next loads ("Loading texts…" status); a new search clears the rows instead (`lib/useTextThreadsAdmin.ts:59-76`).
3. Rows link to `/texts/:threadId`. Each shows the contact name, then "· formatted number" when members have it, the **composing indicator**, the last-message time ("h:mm a" today, "MMM d" this year, "MMM d, yyyy" otherwise, recomputed each minute), and a preview prefixed "Staff: " for outbound texts (`:127-167`).
4. Empty states: "No more texts." past the last page, "No phone number matches that search.", and "No texts yet.". Errors: "Couldn't load texts." and a refresh-error status. The browser tab title is "Texts - Admin".
5. Live updates: the socket refetches the list, throttled to 5 s (see Cross-cutting).

**Data:** `useTextThreadListAdmin` → `mmsThreadListThreadsAdmin` (query: page, search).

**Shared code:** `common/phone` `phoneSearchTerm`, `formatPhoneNumberForDisplay`; `common/staffText`; `sharedweb/ui/Button`; `shared/lib/useClockMinute`.

**Tests:** `pages/TextsPage.test.tsx` covers the composer name on a row, names and numbers, search kept in the URL, paging both ways, no match, keeping the page up while the next loads, refusing name searches, dropping rows on a new search, the end of search results, offering Newer when a page fails, and re-dating rows after midnight.

---

## `/texts/:threadId`: Text thread

- **New place:** Inbox, with the thread open in the conversation pane.
- **Purpose:** read and reply to one phone number's thread, mark it handled or needing a reply, or mark it opted out.
- **Page:** `pages/TextThreadPage.tsx` (thread UI shared with the member record)

**Capabilities: page**
1. An **All texts** link to `/texts`. The heading is the contact name, which is also the browser tab title "{name} - Texts - Admin" (`TextThreadPage.tsx:30-41`).
2. **People on the number**: the formatted number and a link to "{name}'s member page" for each member, or "No member has this phone number." (`:69-91`).
3. A missing thread shows one error: "Couldn't load this thread." (`:43-47`).
4. **Composer availability** (`:93-138`):
    - "This number can't be texted, such as a short code or a sender name." (no opt-out control either).
    - The opted-out notice: "This number opted out of texts. It can opt back in by texting START."
    - When no member has the number and it hasn't texted in 30 days (`NON_MEMBER_REPLY_WINDOW_DAYS`), staff can reply only once it texts again.
    - Otherwise the composer appears, using the members' shared time zone when they all have the same one.
5. Keyed on `threadId`, so moving to another thread starts fresh (`:21`).

**Capabilities: thread section** (`components/texts/TextThreadSection.tsx`)

6. A **Texts** header with a refresh-error status (a failed poll keeps the thread).
7. **Mark handled / Mark needs reply**: the `replyState` decides which shows. needs_reply gives "Mark handled" and handled gives "Mark needs reply". It is hidden when answered or opted out. The mark applies through the newest text shown (`throughId`). Pending labels read "Marking handled…" and "Marking needs reply…". A failure raises a persistent error toast. Every view refreshes after a mark (`:83-106,187-214`).
8. **Mark opted out** shows only for a textable number that hasn't opted out. Its confirm explains the consequences: no texts at all until START, and others on the number are opted out too. Pending: "Marking opted out…". Afterwards an "Opted out" badge receives focus, once, and only if focus was on the body. A failure gives a persistent toast and refetches the thread. A 409, meaning already opted out, counts as success. The pending state survives remounting the page, because it is read from the mutation cache (`:61-81,136-155`, `useTextThreadsAdmin.ts:158-177`).

**Capabilities: history** (`components/texts/TextHistory.tsx`, `lib/useOlderTexts.ts`)

9. Bubbles: outbound on the right, dark; inbound on the left, light. The author line shows the sender's staff name, "Automated", or "Deleted user"; for inbound texts, the contact name. The time is "MMM d, h:mm a", with the year added for earlier years. Delivery status labels: Sending, Scheduled, Sent, Delivered, Read, Partly delivered, Not delivered, Failed, Canceled. Unknown statuses show as-is. Failures show in red with their reason (the Twilio message or "Twilio error {code}") (`TextHistory.tsx:163-242`, `lib/memberTexts.ts:8-34`).
10. **Thread events** appear inline under the text they followed: "Marked handled / Marked needs reply by {admin} · {time}" (`:206-211`).
11. **Attachments**: inline images link to the full image, other files show "Download attachment ({type})", and there are "Attachment still loading…" and "Attachment unavailable" states. Media are served from `/mms-threads/media/:id` (`:244-272`).
12. **Show older texts** pages backwards, keeping the reader's place, moving focus to the thread after the last page, and saying "Couldn't load older texts." on failure. Older pages aren't polled. Texts that slide out of the polled newest page stay shown. Older texts are dropped when the number changes (`:106-120`, `useOlderTexts.ts`).
13. **Scroll behaviour**: the history opens at the end and follows new texts while the reader is near the bottom (within 40 px). Otherwise the reader's place holds through polls and image loads. It jumps to the end after the admin's own send, or when a conflict warning appears (`:47-89`).
14. Accessibility: the scroll region is labelled "Text history" and is focusable. Only the polled newest page is a `role="log"`, so older texts loading aren't read out (`:91-137`).

**Capabilities: composer** (`components/texts/TextComposer.tsx`)

15. Labelled "Text {name}", with the **composing indicator** for other admins beside it, and an auto-growing textarea (2–8 rows).
16. Hints:
    - A segment count ("N segments", with an emoji/UCS-2 note) through `sms-segments-calculator`, or before typing, "Up to 1,600 characters…".
    - The recipient's local time ("Their local time: 9:15 PM"), or that it is unknown, or that the time zone is invalid. Updated each minute.
17. Validation:
    - Over 1,600 characters gives an alert, with an emoji counting as two characters, as on the server.
    - Sending with only spaces gives "Write a text to send.".
    - A late-night warning, **quiet hours from 8 PM to 8 AM** in the member's zone, with **Send anyway** (focused) and **Don't send** (`:105-115,208-248`, `memberTexts.ts:70-107`).
18. **Conflict handling**: a send carries `afterId`, the newest text the draft has seen. A 409 for NewerTexts or NumberChanged refetches the thread, scrolls to it, and warns "New texts arrived while you were writing…" or "This member's phone number changed…", offering Send anyway. If that refetch fails: "…couldn't be loaded. Try again in a moment." Quiet hours aren't asked about again after a confirmed send (`:24-40,116-137`, `useTextThreadsAdmin.ts:141-155`).
19. Send shows "Sending…" (aria-disabled, so a send can't be duplicated). Text typed during a send is kept. A failure keeps the text and says it "may not have gone out". If the composer has closed by then, a persistent toast includes the text itself (`:116-153`).
20. After a send, the message is patched into the thread, and every thread view, Needs reply and the Texts list are refreshed (`useTextThreadsAdmin.ts:126-137`).
21. Reports this admin composing to others (see Cross-cutting).

**Data**
- `useNumberThreadAdmin` → `mmsThreadGetNumberThreadAdmin` (with `before` for older pages), `mmsThreadSendInThreadAdmin`, `mmsThreadMarkThreadOptedOutAdmin`, `mmsThreadMarkThreadHandledAdmin`, `mmsThreadMarkThreadNeedsReplyAdmin`
- Socket `/mms-threads` (`shared/lib/messagingSocket`)
- Media at `${apiUrl}/mms-threads/media/:id`

**Shared code:** `common/staffText` (`STAFF_TEXT_MAX_LENGTH`, `StaffTextConflict`, `NON_MEMBER_REPLY_WINDOW_DAYS`), `common/mmsThreads` (events, schemas, `COMPOSING_TTL_MS`), `common/phone`, `common/result`; `shared/lib/useClockMinute`, `hey-api`, `retryQuery` `isRefused`, `queryKeys`; `sharedweb/ui/Button`, `ToastProvider`; npm `react-textarea-autosize`, `sms-segments-calculator`, `socket.io-client`.

**Tests:** `pages/TextThreadPage.test.tsx` (composing report and indicator, a number with no member, conflicts, a missing thread, member links, local time from one member or shared by several, reply window closed, short codes, marking member views and the Texts list stale, handled and undo, a mark during a poll, mark failure, no mark when answered, opt-out), `components/texts/TextComposer.test.tsx` (24 cases on quiet hours, conflicts, length and segments, focus, failures after close), `ComposingNotice.test.tsx`, `lib/mmsThreadsLive.test.ts` (18 cases on push handling), `lib/useReportComposing.test.tsx`, `lib/useTextThreadsAdmin.test.ts`, plus the `MemberTextsSection*.test.tsx` suites, which exercise the same components.

**Notes**
- The member record and this page are two entry points to the same number's thread, through different endpoints (by user versus by thread id). Changes in one mark the other stale.
- In the new single Inbox pane, both cases must be kept: a member with several numbers over time, and several members sharing one number.
- The opt-out confirmation copy is legal and consent-relevant. Keep it verbatim.

---

## Summary

All 16 routes in the group are covered, plus the cross-cutting sidebar badges, admin search, socket and polling, and composing layer: about 200 enumerated capabilities. The pieces a redesign is most likely to lose:

- **Inbox:**
  - the Needs reply held-rows guard against reordering under the pointer or keyboard
  - texting's quiet-hours and newer-texts conflict warnings, the 30-day reply window for non-members, and the throughId semantics of mark handled
  - the polling fallback (10 s / 30 s offline, 60 s online)
- **Member record:**
  - impersonation (Log in as user)
  - the typed-email Delete account flow with Slack reason and screenshot
  - Suspend contract
  - recording an activity on a member's behalf
  - the read-only notification-settings and notification-history panes (email HTML preview, click and open rates)
- **Members list and table:**
  - the contract and completion filters hidden inside `CommunityMembersTable`
  - Shuffle
  - Card view's per-card tag editing and action details
- **Groups and assignment:** group assignment's localStorage drafts and capacity rules
- **Clusters:** the clustermates clipboard export
- **Member lists:** deleting a list together with fixes to the formulas that read it
- **Staff directory:** the worldalliance and absolute-link content check (it also has no leave guard and no keyboard reorder today)
- **Welcome queue:** the link out to the frontend comment page

Existing defects worth not carrying over:
- the unguarded `relationByActionId[...]` lookups in UserCard and UserActionsSection
- removing a group member or leader has no confirmation
- the dead `?from=groups` parameter
- the never-rendered Remove in the group progress table
- "Loading groups..." on the Tags page
- several title-case headings
