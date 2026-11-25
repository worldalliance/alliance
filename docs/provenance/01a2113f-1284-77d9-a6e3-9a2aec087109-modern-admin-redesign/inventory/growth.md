# Growth, content, activity, research and shell: functionality inventory

Read from the code at c722280863, then refreshed at ff886c540b after the rebase onto `main` took in #1028, #1088, #1089 and #1090. Line citations in the entries those PRs touched are to that revision, an entry they added or changed names the PR, and what they removed is marked **Removed** in place with its ID kept. This inventory is the checklist the redesign is verified against, so that nothing staff can do today is lost. It was written against the prototype's page map before the corrections in this directory's `PLACES.md`: a `PLACES.md:<line>` citation refers to that earlier version, and where a note here says the map lacks something or adds something new, `PLACES.md` is the current answer.

Paths are relative to `apps/admin/src/` unless they start with `sharedweb/`, `shared/`, `common/` or `kora-review/`. "Toast" means `useToast` from `sharedweb/ui/ToastProvider`. "Refusal toast" means `lib/useRefusalToast`, which shows the server's refusal message or a fallback. "ConfirmDialog" is `components/ConfirmDialog.tsx`. "InlineTextInput" (`components/InlineTextInput.tsx:34-37`) saves on blur, blurs on Enter and cancels on Escape.

**No page in this group keeps state in the URL** except `/posts/:postId`, `/videos/:videoId`, `/general-updates/:id` (plus `?tab=` and `?suiteId=` there) and the Kora record routes. Every filter, sort, page number, search and toggle below lives in React state and resets on reload. A redesign that adds URL state adds behaviour; one that drops these controls loses it.

---

## App shell

### Root, providers and boot

- **Files:** `entry.client.tsx`, `start.tsx`, `root.tsx`, `ConfigErrorScreen.tsx`, `lib/AuthContext.tsx`, `lib/analytics.ts`, `lib/mmsThreadsLive.tsx`.
- **Boot:** `start()` fetches the web runtime config, sets the API base URL, and only then hydrates (`start.tsx:10-33`). If the config fails, or has no API URL, it renders `ConfigErrorScreen` instead: heading "The admin panel couldn't load its settings", focus moved to the heading, a **Reload** button, and a **Details** disclosure with the error (`ConfigErrorScreen.tsx:4-30`).
- **Router error capture:** `HydratedRouter onError={captureRouteError}` (`entry.client.tsx:12`).
- **Global providers, outer to inner** (`root.tsx:129-144`): `SiteOriginLinkProvider` (site origin for links), `QueryClientProvider` (`sharedweb/lib/queryClient.ts`: 1-day gcTime, retry up to 3 unless refused, **no global mutation error handler**), `AuthProvider`, `Analytics`, `ShareLinkViewerProvider` (Anonymous), `ToastProvider`.
- `registerErrorStatus(client)` (`root.tsx:31`); `holdChunkReloads()`: a chunk that fails to load shows the boundary's advice instead of reloading and losing unsaved work (`root.tsx:33-35`).
- `useNumberInputScrollGuard()` in `Layout`: scrolling the page doesn't change a focused number input (`root.tsx:101`).
- `HydrateFallback`: a large spinner (`root.tsx:37-43`).
- **Error boundary** (`root.tsx:45-98`): in dev, shows message and status; in prod, the route status or the error message plus stack, else "Unknown Error". If PostHog hasn't identified staff yet, it mounts its own `AuthProvider` to identify them before sending the error.
- Page `<title>` defaults to "Alliance"; favicon `/god.png` (`root.tsx:108-109`).
- **Analytics** (`lib/analytics.ts`), prod builds with a key only: PostHog with localStorage persistence named `admin`, no autocapture, no session recording, no surveys, no flags request (`:114-146`). Page views are sent per route **template**, not path, so ids stay out of PostHog (`:39-58`, `:252-270`). URLs in properties are replaced by templates, other origins by their origin, `title` and UTM/click-id params are dropped (`:15-100`). Nothing is sent until staff is identified; an impersonating admin isn't identified (`:102-111`, `:202-205`). Route errors are captured except not-found, held until identity settles (`:153-170`). Super-property `app: "admin"` plus build properties (`:186-188`).

### Auth flow

- **Files:** `lib/AuthContext.tsx`, `adminlayout.tsx`, `sidebar.tsx:33-38`, `loggedoutonly.tsx`, `pages/LoginPage.tsx`.
- Bootstrap: `GET /auth/me` (`authMe`); if that fails, `authRefreshTokens` then `authMe` again; sets `user` and `isImpersonation` (`AuthContext.tsx:37-73`).
- `login(email, password)`: `authAdminLogin` in cookie mode, then `authMe`, then a full-page redirect to `/` (`:76-97`).
- `logout()`: `authLogout`, then a full-page redirect to `/login` (`:99-103`).
- Wraps children in `ViewerAuthenticationProvider` from `sharedweb/ui` (`:119`).
- **Guard:** `adminlayout.tsx:9-14` logs out (and so redirects to `/login`) when the signed-in user isn't an admin, or when loading has finished with no session. `sidebar.tsx:34-38` repeats the non-admin check.
- **Staging banner:** on staging, a fixed green strip repeating "staging" across the top of every page (`adminlayout.tsx:22-35`).
- **Leave guard host** (added in #1028, refined in #1090): `adminlayout.tsx:19-21` wraps every signed-in route in `components/LeaveGuard.tsx`, the single router blocker behind every page's unsaved-changes prompt (`lib/useLeaveGuard.ts`). An editor anywhere in the shell registers with it; `useLeaveGuard` throws outside it. A redesigned shell has to keep one such host above its routes. The pages that use it are in the Tasks, Forms and Members inventories; none of this group's pages do.
- `loggedoutonly.tsx` is a bare `<Outlet />`; despite its name it doesn't redirect a signed-in user away from `/login`.

### `/login` → Login, unchanged (outside the shell)

- **Purpose:** staff sign-in.
- On mount, calls `appHealthCheck`; while it runs shows "Checking server status..."; on failure shows the red banner "Unable to connect to server. Please try again later." (`LoginPage.tsx:16-30`, `:64-67`).
- Email field (type email, required, autocomplete email, placeholder "your@email.com") and password field (required, autocomplete current-password) (`:70-93`).
- **Log in** button, disabled and reading "Logging in..." while loading (`:96-102`).
- A failed login shows the error message ("Login failed") in the red banner (`:44-48`, `:55-61`).
- **Data:** `appHealthCheck`, `authAdminLogin`, `authMe`, `authRefreshTokens`, `authLogout` (`shared/client`).
- **Tests:** none for LoginPage or AuthContext.

### Sidebar (`sidebar.tsx`, `components/SidebarNav.tsx`, `components/adminNavEntries.tsx`, `lib/sidebarFolders.ts`)

- Wraps every sidebar route in `MmsThreadsLiveProvider` (`sidebar.tsx:136-140`). Routes outside the sidebar layout: `/invite-feed`, `/kora-participants/preview/:batchId`, `/login` (`routes.ts:4-10`, `:83`).
- Header "Alliance Admin", **red in production**, grey elsewhere, and since #1028 a red **"Production" badge** under it in production, so the environment is named in text and not by colour alone (`sidebar.tsx:72-84`).
- **Collapse toggle** (PanelLeft icon): 220px open, 48px collapsed; collapsing hides the nav and footer. Since #1028 it is a real button named "Collapse sidebar" / "Expand sidebar" with `aria-expanded`, and the collapsed nav is `inert`, out of the tab order (`sidebar.tsx:31-48`, `:64`, `:106-119`). Not persisted.
- Footer: the signed-in staff member's email and a **Log out** icon button (`sidebar.tsx:92-105`).
- Main area width is `100vw − sidebar width` (`sidebar.tsx:123-130`).
- **Nav entries, in order** (`adminNavEntries.tsx:59-235`): Stats `/`; Projects; Kora participants; Actions; folder **Action Planning** (Priority, Scheduled Plans, Contracts, Formulas, Member lists); folder **Activity** (Live Invite Feed `/invite-feed`, Event Log); folder **Links** (Custom Links, Hosted Docs, Invite Links, User Invites `/invites`, Invitation Message, Share Links, Share Targets); folder **Waitlist** (Entries, Emails, Organizations); Members; Needs reply (badge); Texts; Groups (badge); folder **Community** (Welcome Queue, Staff Directory, Member Map, Away Members, Clusters, Friend Graph); folder **Outreach** (Ambassador Program, Outreach Partnerships (badge)); folder **Content** (Action Updates, General Updates, Forum Posts `/posts`, Image Upload, Videos).
- **Not in the nav** from this group (reachable only by URL or in-page links): `/test-push`, `/invites/graph` (linked from `/invites`), and the Kora assignment and preview routes (linked from `/kora-participants`).
- Active link: exact match, or a path under it (except `/`), with `aria-current="page"` (`SidebarNav.tsx:18-19`, `:42-52`).
- **Folders:** click to expand or collapse (`aria-expanded`); the folder holding the current page opens automatically; open folders persist in localStorage `alliance.admin.sidebarOpenFolders.v1`, dropping unknown folders and ignoring malformed storage (`SidebarNav.tsx:64-97`, `sidebarFolders.ts:14-37`).
- **Badges** (`SidebarNav.tsx:24-40`): red, capped "99+" (`shared/lib/badgeCount`), hidden at 0, "!" when the count couldn't load, with screen-reader text "(n)" or "(count couldn't load)". A **collapsed folder shows the sum** of its links' badges (`:123-130`).
- **What the badges count:**
  - **Needs reply:** the length of the needs-reply thread list, `mmsThreadNeedsReplyThreadsAdmin`; null (shows "!") if the first load fails, last count kept if a later poll fails (`lib/useTextThreadsAdmin.ts:38-57`). Polls every **30 s**, or every **60 s** while the `/mms-threads` socket is connected (`:30-36`, `:47`); the socket also refetches it on change, throttled to once per 5 s (`lib/mmsThreadsLive.tsx:59`, `:135`, `:158`).
  - **Groups:** every member returned by `userGroupAssignmentGetGroupAssignmentMembersAdmin` (members awaiting a group) (`sidebar.tsx:27-28`, `lib/useGroupAssignmentAdmin.ts:16-26`). No polling.
  - **Outreach Partnerships:** responses from `actionPartnershipsFindAllResponsesAdmin` with **no internal notes yet** (`notesHistory.length === 0`) (`sidebar.tsx:16-24`). No polling.
- **`MmsThreadsLiveProvider`** (`lib/mmsThreadsLive.tsx:165-220`): one `/mms-threads` socket per tab once signed in. On connect, refetches every thread, Needs reply and the Texts list; on disconnect, clears composers; `ThreadChanged` refetches the Texts list (throttled 5 s), Needs reply if affected, and the changed number's threads; `Composing` lists other admins typing. Hidden tabs only mark stale. Used by the Inbox pages, but mounted for the whole shell.
- **Tests:** `components/SidebarNav.test.tsx` (badge after label on link and collapsed folder; Needs reply count and "count couldn't load"; 99+ cap), `lib/sidebarFolders.test.ts` (all closed by default, round-trip, drops removed folders, ignores malformed storage), `lib/mmsThreadsLive.test.ts` (18 cases on refetch and throttle rules), `root.test.tsx` and `lib/analytics.test.tsx` (error capture and identity), `start.test.tsx` (config before hydrate; error screen on failure or missing API URL), `pages/CustomLinksPage.test.tsx:191` ("places Custom Links under the renamed Links folder").

### AdminSearch (`components/AdminSearch.tsx`, `lib/adminSearch.ts`)

- **Search** button in the sidebar with a ⌘K hint; **⌘K or Ctrl+K anywhere** opens the palette (`AdminSearch.tsx:148-176`).
- Modal "Search the admin panel", autofocused input, placeholder "Pages, actions, suites, members, forms, groups" (`:83-101`).
- Searches six kinds, **up to 5 each**, names starting with the query ranked first (`adminSearch.ts:37-59`): **Pages** (every nav entry by label, detail = folder name); **Actions** (name or exact id; detail = suite name and "Archived"); **Suites**; **Members** (name, email or phone via `memberSearchMatcher`, or exact id; detail = email); **Forms** (title or id; detail = action using it); **Groups** (`:61-148`).
- Blank query shows nothing; no results shows "No matches" unless lists are still loading (`:129-131`).
- Arrow Up/Down move the highlight (wrapping), mouse-move highlights, Enter or click opens and closes the palette; highlight is clamped as lists load (`:68-80`, `:104-127`).
- Footer names lists still loading ("Loading actions, …") and lists that failed ("Couldn't load forms, so they aren't searched.") (`:39-55`, `:133-143`).
- **Data:** `useUsersAdmin` (`GET /user/list`), `useActionsAdmin` (`shared/lib`, `GET /actions/all`), `useActionSuitesAdmin` (`GET /actions/suites`), `useFormsAdmin` (`shared/lib`, `GET /tasks/listForms`), `useCommunitiesAdmin` (`GET /community/list`). Loaded only while the palette is open.
- **Shared code:** `sharedweb/ui/Modal`.
- **Tests:** `components/AdminSearch.test.tsx` (⌘K and Enter navigate; failed-list message; a result arriving after arrowing still opens), `lib/adminSearch.test.ts` (every kind by name, starts-first; pages in folders; members by email or phone; suite and Archived detail; exact id; blank query).

### MemberZoneLink (`components/MemberZoneLink.tsx`)

- Fixed bottom-left house icon, "Open in member zone" (label and tooltip), linking to the member site's counterpart of the current admin page via `memberPathFor` (`sharedweb/lib/zoneLinks.ts:7-25`: e.g. `/posts/4` → `/forum/post/4`, `/actions/:id`, `/member/:id`, `/groups`, `/general-updates`, `/action-updates`; fallback `/`).
- **Tests:** `components/MemberZoneLink.test.tsx` (counterpart URL; tooltip).

---

## `/` Stats → Home › "Needs you, then organization stats" (`#/home`, rail: Home)

- **Purpose:** organization-wide analytics dashboard.
- **Page:** `pages/StatsPage.tsx`. Cards, top to bottom:

**Aggregate stats** (`components/stats/AggregateStatsCard.tsx`)
- Total members (`signedUsers`) (`:41-44`).
- Completion reliability: completed ÷ joined across action stats, **excluding onboarding and optional actions**, 2 decimals, "[No data]" if none (`:47-66`).
- All-time churn: latest contract-status point's churned ÷ total ever signed (`:69-86`).
- Last month churn (`contractStatusHistory.monthlyChurnRate`) (`:88-95`).
- Total expected weekly member time: members × 15 min, in hours/week (`:99-106`).
- Annual expected value of member time, with an **editable hourly rate** (default $15): hours × rate × 52 (`:108-127`).
- Loading and refusal-aware error states (`:27-35`).

**Recent missed actions** (`components/stats/MissedActionsCard.tsx`)
- Loads only on **View actions** click; each later click refetches; button reads "Loading..." while fetching (`:15-21`, `:49-56`).
- Two groups, "Missed last action" and "Missed last two actions", each with a count and a scrollable list of members (link to `/member/:id`, plain `<a>`, full reload) with their last action's name (`:23-37`, `:63-93`).

**Action completion and churn after joining** (`components/stats/PlatformTenureCohortCard.tsx`)
- "Weeks after joining" number input (default 4) and **View cohort**; rejects non-integers or negatives without requesting ("Weeks on platform must be a whole number.") (`:26-34`).
- Six stats: cohort size, action completion %, churn rate %, active / churned, completed, assigned (`:98-148`).
- Bars for up to 12 actions: assigned vs completed, "completed/assigned (rate%)" (`:150-190`).
- Uses `lib/useAppliedQuery` (retries the same value after a failure, drops shown data when a reload fails).

**Member reliability by assignment week** (`components/stats/MemberReliabilityCard.tsx`)
- "Completed action weeks" input (default 5, min 1) and **View reliability**; rejects < 1 or non-integers (`:24-34`).
- Two rates: "First assigned week" and "Fourth assigned week or later", each % with "completed / assigned" (`:88-120`).

**Invite conversion funnel** (`components/stats/InviteFunnelCard.tsx`)
- From/To date inputs (default last 14 days via `lib/recentInviteFunnelRange`), **Last 7 days** button; changes refetch immediately (`:8-10`, `:81-117`).
- Four bars: Invites Created, Invites Used, Signed Contract, Finished Onboarding; value labels; each bar's % of the previous (`:21-42`, `:161-216`).

**Members over time** (`components/stats/MembersOverTimeChart.tsx`)
- From/To date inputs (default last 6 months, `StatsPage.tsx:64-72`).
- Stacked area: active (green) under churned (red) (`:52-65`, `:239-249`).
- Hover: nearest point's vertical line and tooltip "N% churn" and "N members" (`:84-121`, `:251-315`). Legend.
- Says "Loading..." (not "none") while a range change loads (`StatsPage.tsx:104-105`).

**Daily stats range** (`StatsPage.tsx:167-226`)
- Start and End date inputs (default last 30 days) and **Update**; rejects invalid dates ("Please provide valid start and end dates.") and start after end ("Start date must be before the end date.") without requesting (`:35-54`, `:125-130`).
- **Last 7 days** and **Last 30 days** apply at once and clear a refused range (`:132-142`).
- "Loading daily stats…", "No daily stats for this range." and the load error (`:218-226`).
- This range feeds **only** the collapsible Daily Stats table at the bottom (see Notes).

**Action completion stats** (`components/stats/ActionCompletionBarsChart.tsx`)
- **Recalculate** button (`analyticsRecalculateActionStatsAdmin`), "Calculating..." while pending; "Unable to recalculate action stats." on failure (`:128-147`).
- Horizontal bars for actions with `showInChart`: expected total (joined + withdrawn, grey, **striped blue while the action's end date is in the future**), completed (green), withdrawn (orange), "completed/total (rate%)" (`:70-73`, `:211-340`).
- Hover a row: tooltip with Completed, Withdrawn, Joined, Rate (`:344-388`). Legend with In progress pattern.
- Empty: "No action stats available. Click Recalculate to generate." Load failure says so instead (`:137-154`).

**Completions throughout week** (`components/ActionCompletionCurveChart.tsx`, also used on the action dashboard)
- **Daily / Hourly CDF** toggle (default hourly) (`:171-192`).
- Action select ("All actions" plus each action, newest first); **Left/Right arrow keys on the select step through actions** (`:193-221`, `:69-80`).
- Duration (days) min/max filter, **defaulting to ±3 days of the selected action's duration**; **Clear filter** (`:93-109`, `:222-255`).
- Hover tooltip: hourly = cumulative %; daily = day, completions today %, total %, plus completed and joined per action or action count for the average (`:258-316`).
- Load failure: "Unable to load action completion curves." (`:146-150`).

**Cumulative and weekly completion rate** (`components/stats/CompletionRateCharts.tsx`)
- Two charts sharing one From/To range (default last 5 months) and one **Absolute** checkbox shown on both (0–100% axis vs padded) (`:28-38`, `:91-101`).
- Cumulative: running average rate; hover shows date, avg rate, total actions, and up to the action names (cut at 40 chars) (`:105-136`).
- Weekly: week rate; hover shows week, rate, actions, completed/joined, action names (`:138-172`).

**Reminder link click rate by action** (`components/stats/ReminderClickRateCard.tsx`)
- From/To range (default last 5 months), filtering reminder groups by send date client-side (`:25-44`).
- One bar chart per channel (Email, Text) (`ReminderClickRateBarChart.tsx`); hover tooltip: action name, channel, click rate, reminder groups averaged, clicked/sent, action id (`:131-176`).
- "No sent reminder groups with email/text link clicks in this date range." / load failure (`:103-115`).

**Cohort completion reliability** (`components/stats/CohortRetentionCharts.tsx`)
- Multi-line chart, one line per weekly signup cohort with completions, coloured older→newer with a gradient legend (`:34-86`, `:101-137`).
- **Week range min/max inputs** (default 0–20) shared with the grid (`:20`, `:111-112`).
- Hover: cohort week, weeks since join, completion rate, completed, joined, cohort size (`:118-136`).

**Cohort completion grid** (`components/stats/CohortCompletionGrid.tsx`)
- Heatmap: rows = cohorts newest first with member counts, columns W0…Wn within the week range, cells = week completion % coloured red→green (`:49-77`, `:145-238`).
- Hover a cell: week, action start date, cohort, completed, joined, and the actions with member counts (`:79-111`, `:239-300`).
- "No weeks in the selected range." (`:135-141`).

**Time to churn** (`components/stats/TimeToChurnCard.tsx`)
- Histogram of churned members by whole weeks from signing to last completed action; count "N churned members"; bar tooltip "a-bw: n members" (`:17-78`, `:85-95`, `:170-201`).
- A refetch failure hides the shown histogram (`:12-15`).

**Collapsible tables** (`StatsPage.tsx:249-415`)
- **Daily Stats (N days)**, newest first: Date, Actions completed, Anon forms, Members signed, Invites created, Invites accepted, Suspended.
- **Action Stats (N actions)** (only when there are stats): Action, Completed, Joined, Completion Rate (green ≥ 90%, yellow ≥ 70%, red below; "N/A" if none joined), Action Date.

- **Data** (all `apps/admin/src/lib/`, endpoints from `shared/client`): `useDailyStatsAdmin` → `analyticsGetDailyStatsAdmin`; `useActionStats` → `analyticsGetActionStatsAdmin`, `analyticsRecalculateActionStatsAdmin`; `useContractStatusHistoryAdmin` → `analyticsGetContractStatusHistoryAdmin`; `useAggregateStatsAdmin` → `analyticsGetAggregateStatsAdmin`; `useMissedActionsAdmin` → `analyticsGetMissedActionsAdmin`; `usePlatformTenureCohortAdmin` → `analyticsGetPlatformTenureCohortAdmin`; `useMemberReliabilityWindowAdmin` → `analyticsGetMemberReliabilityWindowAdmin`; `useInviteFunnelAdmin` → `analyticsGetInviteFunnelAdmin`; `useActionCompletionCurvesAdmin` → `analyticsGetActionCompletionCurvesAdmin` (per granularity); `useReminderGroupClickRatesAdmin` → `analyticsGetReminderGroupClickRatesAdmin`; `useMemberCompletionRetentionAdmin` → `analyticsGetMemberCompletionRetentionAdmin`; `useTimeToChurnSamplesAdmin` → `analyticsGetTimeToChurnSamplesAdmin`. No polling anywhere.
- **Shared code:** `shared/lib/dateInput`, `shared/styles/util` (`cn`), `components/TimeSeriesChart.tsx` (admin-local; date-range and numeric x-range inputs at `:44-110`), d3, chroma-js, `lib/adminRefusal`.
- **Tests:** `pages/StatsPage.test.tsx` (reminder click rates none/failed; daily stats failed; refused range not requested; quick range clears refusal; valid range requested; funnel stages and failure; members-over-time none, failed, and "loading not none" during a range change; tenure cohort shown, non-integer refused, retry same weeks, drops shown cohort on failed reload, "loading not failed" while retrying, server refusal message); `components/stats/*.test.tsx` (AggregateStats excludes onboarding/optional, load failure; MissedActions per-group lists, reload each click, failure, failed reload; MemberReliability rates, < 1 refused, failure, reapply after failure, refusal reason, hides rates on later failure; MembersOverTime churned drawn under active, hover nearest point; ActionCompletionBars withdrawals in expected total, hover counts, recalc prompt, load failure vs prompt, recalc failure; CompletionRate Absolute toggles both charts, hover week and day with cut names; ReminderClickRate per-channel bars and hover, excludes groups before start; CohortRetention excludes cohorts without completions, failure; CohortCompletionGrid newest first in range, hovered cell detail; TimeToChurn weekly bins, none, failure vs none, hides on refetch failure, refusal reason); `components/ActionCompletionCurveChart.test.tsx` (keeps selected action across granularity, failure vs empty, keeps typed duration filter with no curves); `components/stats/completionRateData.test.ts`, `contractStatusHistory.test.ts`, `reminderClickRateData.test.ts`, `lib/recentInviteFunnelRange.test.ts`, `lib/actionCompletionCurveChartData.test.ts`.
- **Notes:**
  - The Start/End/Update range at the top of the lower half only drives the collapsed Daily Stats table; every chart has its own range. Easy to mistake for a page-wide filter.
  - Four independent date ranges (funnel 14 d, members 6 mo, completion 5 mo, reminders 5 mo) plus the daily range; none persist.
  - `MissedActionsCard` uses `<a href>` (full reload) rather than `Link` (`:78-83`).
  - PLACES puts "Needs you" above the stats; today `/` has no "needs you" section, only the three sidebar badges.

---

## `/invite-feed` Live Invite Feed → Growth › Invites › Live feed (palette; its Full screen button gives today's chromeless view)

- **Purpose:** a chromeless, display-friendly live count of invites created since a start time.
- **Page:** `pages/InviteFeedPage.tsx`, outside the sidebar layout.
- Header "The Alliance", a **Live / Reconnecting** indicator from the `/event-log` socket (`:115-126`).
- **Feed settings** gear toggles a panel (`:127-134`, `:154-189`):
  - "Count invites starting at, local time" datetime-local, default start of today; an empty value is ignored (`:156-172`).
  - "Number each invite" checkbox, default on (`:173-187`).
  - Both persist in localStorage `alliance-admin-invite-feed-settings`, validated on read (`:7`, `:23-46`, `:76-80`).
- Big count: "N invites since <start>" (`:144-151`).
- List, newest first (ties by id): optional number (counting down), "<inviter> created a *individual invite*" or "*group invite*", time (`:98-107`, `:217-247`).
- **Live updates:** refetch on each `invite-created` socket event **and** a 10 s poll (`:89-96`; `lib/useInviteFeedAdmin.ts:101`).
- States: "Could not load the invite feed." with **Try again**; "Loading invites..."; empty "Waiting for the next invitation. New invites will appear here automatically." (`:192-216`). `aria-live="polite"`.
- **Data:** `lib/useInviteFeedAdmin.ts`: one-time invites from `userOnetimeInviteGetOnetimeInvitesAdmin` paged 200 at a time until older than the start, keeping only `link_unused`/`link_used` (`:27-70`); group (reusable) invites from `shareUrlsFindInviteFeedAdmin({startAt})` (`:83-95`). `lib/useEventLogWebSocket.ts` (socket.io `/event-log`, `subscribe-event-log`, `invite-created`).
- **Shared code:** `sharedweb/ui/DateTimePicker` (`formatLocalDateTime`).
- **Tests:** none.
- **Notes:** its own fonts and palette, unlike the rest of admin. The websocket and the poll both refetch. Uses `console.log` on connect/disconnect (`useEventLogWebSocket.ts:33`, `:39`).

## `/invite-links` Invite Links → Growth › Invites › Invite links (palette)

- **Purpose:** every invite link (individual and multi-use) with accounts, signers and retention.
- **Page:** `pages/InviteLinksPage.tsx`.
- Explainer: initial signers counts each account once; retention is the share of initial signers whose contract is active now (`:50-54`).
- **Type** filter: All links, Individual, Multi-use; **Sort**: Newest first, Oldest first, Most accounts first, Fewest accounts first. Both are server-side and reset to page 1 (`:14-23`, `:55-97`).
- Table columns: Link (label, URL link, **copy** button "Copy invite link <label>" with toasts "Invite link copied" / "Could not copy invite link"), Type, Created, Accounts created, Initial signers, Retention ("N% (retained/initial)" or "—") (`:111-170`).
- Total "N links" and Pagination, 50 per page; previous page dimmed with `aria-busy` while the next loads (`:111-113`, `:176-183`; `lib/useInviteLinksAdmin.ts:5`).
- Empty: "No invite links match this filter."; error with **Retry** (`:98-105`, `:171-175`).
- **Data:** `lib/useInviteLinksAdmin.ts` → `inviteLinkAdminSearch({kind, sort, page, limit})` via `shared/lib/usePaginatedQuery`.
- **Shared code:** `sharedweb/lib/clipboard`, `sharedweb/ui/Pagination`, `shared/lib/dateFormatters`.
- **Tests:** `pages/InviteLinksPage.test.tsx` (per-link counts and retention fetching only the selected page; filter and sort sent to server and reset to page 1; empty result without page controls; retry).

## `/invites` User Invites → Growth › Invites › Invites (palette)

- **Purpose:** create a one-time invite on a member's behalf and browse past invites.
- **Page:** `pages/InvitesPage.tsx`.
- **Create an invite:** Invitee text (placeholder "preferably a first name capitalized") and Inviting user (`UserSelect`, single); **Create Invite** disabled while pending; nothing happens without an inviting user; success clears the user and returns to page 1 (`:40-56`, `:81-117`).
- **Invites per Member** (collapsed `<details>`, only when non-empty): Member (avatar, name), Sent, Accepted; load failure "Failed to load invite stats." with **Retry** (`:118-167`).
- **View Invite Graph** link to `/invites/graph` (`:170-175`).
- **Past Invites** list, 50 per page: inviter avatar and name "inviting" invitee (a link to the member's **member-site** profile once they joined), code, status label (`shared/styles/inviteStatus`), **copy signup link** button ("Invite link copied" / "Could not copy the invite link to the clipboard"), info text, created time (`:192-258`).
- Pagination and "N total" only when more than one page (`:260-269`); dimmed while the next page loads; error with **Retry** (`:177-188`).
- **Data:** `lib/useOnetimeInvitesAdmin.ts` → `userOnetimeInviteGetOnetimeInvitesAdmin` (paged), `userOnetimeInviteGetOnetimeInviteMemberStatsAdmin`, `userOnetimeInviteCreateOnetimeInvite` (invalidates both); `lib/useUsersAdmin`.
- **Shared code:** `shared/lib/inviteUrls` (`getOnetimeInviteSignupUrl`), `sharedweb/lib/config` (`getInviteBaseUrl`), `sharedweb/ui/{Avatar, Button, Card, List, Pagination, UserSelect}`, `sharedweb/lib/clipboard`.
- **Tests:** `pages/InvitesPage.test.tsx` (labelled copy button copies signup link and confirms; one invite per submit, clears inviting user, returns to page 1).
- **Notes:** a failed create shows **nothing**: the mutation has no `onError` and the query client has no global mutation handler (`:50-55`). The invitee field isn't cleared on success (uncontrolled input).

## `/invites/graph` Invite Graph → Growth › Invites › Invite graph (palette)

- **Purpose:** force-directed graph of who invited whom and which campaigns referred whom.
- **Page:** `pages/InviteGraphPage.tsx`; `components/force-graph/{ForceGraph, UserGraphFilters, EnumFilterSelect}.tsx`, `components/invite-graph/buildInviteGraph.ts`.
- Waits for fresh users, campaigns and edges (`isFetchedAfterMount`) before drawing; "Loading graph..." (`:273-283`).
- Header counts: "N users, N used invites, N from campaigns", plus "— N matching filters" when filters are active (`:288-293`). Campaign count only counts campaigns the graph can draw (`:257-266`).
- **Partial-load warning** naming users, used invites or campaigns that failed: "The graph below is incomplete — attribution from the missing data shows as 'no attribution'." (`:127-140`, `:296-301`).
- **Filters** (user nodes only; campaign and "NONE" nodes always pass, `:86-90`): **Contract** All / Active / Inactive (default **Active**); **Role** All / Admin / Staff / Regular; **Community** (from users' communities); **Tag** (from users' tags) (`:26-42`, `UserGraphFilters.tsx:10-147`). Non-matching nodes fade to 8%, their links to 5% (`:182-246`).
- **Isolate subgraph** checkbox: hides everything but the selected node's lineage (`:315-325`).
- **Reset filters** (back to Contract: Active) when any filter differs (`:156-162`, `:327-335`).
- Legend: Campaign, "NONE = no attribution" (`:80-83`, `:337-350`).
- **Graph interactions** (`ForceGraph.tsx`): zoom and pan (0.2×–4×), drag nodes, **click a node to select** (click again or background to clear), node tooltip = name, profile pictures as node fill (`:117-132`, `:136-142`, `:203-228`).
- **Selection highlighting:** selected node blue; ancestors (who invited them) amber; descendants (whom they invited) light blue; matching link tones and arrowheads; others fade to 15% (`InviteGraphPage.tsx:169-255`).
- **Data:** `lib/useGraphUsersAdmin` → `userListForGraphAdmin`; `lib/useCampaignsAdmin` → `campaignFindAllAdmin`; `lib/useOnetimeInviteGraphEdgesAdmin` → `userOnetimeInviteGetOnetimeInviteGraphEdgesAdmin`. A failed edges reload draws no cached edges (`:118-121`).
- **Shared code:** d3 only.
- **Tests:** `pages/InviteGraphPage.test.tsx` (plain arrows until selection; ancestor/descendant tones; every marker defined; counts active-only by default once another filter shows the count; names failed users, used invites, campaigns; no cached edges after failed reload; waits for fresh users and edges; draws cached campaigns and names them when their refetch fails).
- **Notes:** not in the sidebar; reached from `/invites`. `ForceGraph` and `UserGraphFilters` are shared with `/friend-graph`.

## `/invite-message-template` Invitation Message → Growth › Invites › Message template (palette)

- **Purpose:** edit the message members copy from an unused invite.
- **Page:** `pages/InviteMessageTemplatePage.tsx`.
- Explainer naming the link token that the app replaces with the invite's link (`:51-60`; token `INVITE_LINK_TOKEN` from `common/inviteMessage`).
- Textarea (10 rows min, max `INVITE_MESSAGE_TEMPLATE_MAX_LENGTH` = 5,000) (`:69-78`).
- Validation: must include the token ("Include <token> where the invite link should appear."), must be under the max ("Keep the message under 5,000 characters."); otherwise shows "n/5,000 characters" (`:35-39`, `:80-89`).
- **Save** disabled while saving, while invalid, or while **unchanged from the saved template**; toasts "Invitation message saved." / "Could not save the invitation message." (`:23-27`, `:90-100`).
- Loading and "Could not load the invitation message." (`:63-67`).
- **Data:** `shared/lib/useInviteMessageTemplate` (`useInviteMessageTemplate`, `useUpdateInviteMessageTemplate`), shared with mobile/frontend.
- **Shared code:** `common/inviteMessage`, `sharedweb/ui/{Button, Card}`, `components/FormTextarea`.
- **Tests:** none.
- **Notes:** no leave guard on unsaved edits.

---

## `/share-targets` Share Targets → Growth › Links › Share targets (palette)

- **Purpose:** manage the allowed off-site URLs the form's "Share URL" component can link to.
- **Page:** `pages/ExternalShareTargetsPage.tsx`.
- List of target cards: name, "id N", preview URL with a sample code appended as the parameter (`appendQueryParam(url, param, "1a2b3c4d5e")`) (`:256-292`).
- **Edit** opens inline Name / URL / Parameter name fields; **Save** disabled unless name and parameter are set and the URL is valid http(s); **changing the URL or parameter asks `window.confirm`** that links already shared keep the old destination; **Cancel**; "Saving…" per row (`:241-277`, `:295-376`).
- **Delete** asks `window.confirm("Delete share target "<name>"? This cannot be undone.")`; "Deleting…" per row; a 404 (already deleted) drops it (`:97-110`; `lib/useExternalShareTargetsAdmin.ts:88-102`).
- **Create share target** form: Name (placeholder "Internal label, e.g. Partner X signup"), URL (inline "Enter a valid http:// or https:// URL."), Parameter name (placeholder "code"); **Create** disabled until valid; errors "Name, URL, and parameter name are all required." / invalid URL; success clears the form and prepends the target (`:68-83`, `:150-211`).
- One page-level error line for any failed create, update or delete, with refusal and session-expired messages (`:44-53`, `:115-119`); load failure shown beside cached targets (`:131`).
- Empty: "No share targets yet." (`:143-145`).
- **Data:** `lib/useExternalShareTargetsAdmin.ts` → `externalShareTargetsFindAllAdmin`, `externalShareTargetsCreateAdmin`, `externalShareTargetsUpdateAdmin`, `externalShareTargetsRemoveAdmin`.
- **Shared code:** `common/url` (`appendQueryParam`, `isValidHttpUrl`), `shared/lib/hey-api` (`thrownRefusalMessage`), `sharedweb/ui/{Button, Card}`, `shared/styles/card`.
- **Tests:** `pages/ExternalShareTargetsPage.test.tsx` (lists; create adds and clears; create refusal keeps form; save leaves edit mode; row saving state; save refusal stays editing; delete removes; row deleting state; delete failure keeps it; 404 drops it; load failure vs none; 401 session expired; keeps targets beside refetch error).
- **Notes:** uses `window.confirm` where the rest of the group uses ConfirmDialog.

## `/share-links` Share Links → Growth › Links › Share links (palette)

- **Purpose:** see a user's or campaign's share links, create trackable duplicates, and create campaigns.
- **Page:** `pages/ShareLinksPage.tsx`; `components/share-links/{CampaignPicker, ShareLinkManager, GroupCard, TargetPicker, shareLinkTargets}.tsx`.
- **Owner kind** select: User or Campaign (`:154-168`).
- **User:** `UserSelect` single, with loading and "failed to load" states (`:170-179`).
- **Campaign** (`CampaignPicker.tsx`): select a campaign; **Create a new campaign** with name (Enter submits), **Invite page description** (max `INVITE_PAGE_DESCRIPTION_MAX_LENGTH`, "Shown under Create an account"), and a picture file input that uploads immediately (`imagesUploadImage`) and previews; success selects the new campaign and toasts "Campaign created"; refusal toasts for upload and create (`ShareLinksPage.tsx:78-125`, `CampaignPicker.tsx:35-112`).
- **Campaign signup link** card for a selected campaign: avatar, the bare referral signup URL on the invite domain, **Copy** (`:209-252`).
- **Create duplicate link** (`ShareLinkManager.tsx:211-267`): Kind = Action / External target / Invite (signup link); for Action or External, a searchable **TargetPicker** (type to filter, click to choose, **Change** to re-pick, closes on outside click; loading and load-error text) listing **non-archived actions** or external targets (`TargetPicker.tsx`, `ShareLinkManager.tsx:75-107`); Invite needs no target; optional Label ("e.g. recruit's name"); **Create duplicate** disabled until a target; success expands that group, clears the label, toasts "Duplicate link created".
- **Existing share links**, grouped by target, newest group first, canonical first then oldest duplicate (`shareLinkTargets.ts:67-109`). Group header: name, subtitle ("Action #id", "External share target", "Signup invite link"), "N links", "N duplicates"; **click to expand/collapse**; groups with duplicates start expanded, manual toggles kept (`GroupCard.tsx:33-55`, `ShareLinkManager.tsx:117-133`).
- Each link row: canonical/duplicate badge; **label, click to edit** inline (max `SHARE_URL_LABEL_MAX_LENGTH`; Enter saves, Escape cancels, Save/Cancel buttons; toast "Label updated"); URL; sid; for invite links "N uses"; **Copy**; **Delete** with an anchored confirm toast "Delete this share link? Any URL already handed out using it will stop working." (`GroupCard.tsx:73-207`, `ShareLinkManager.tsx:135-175`).
- Results that land after switching owner are ignored (`ShareLinkManager.tsx:59-63`, `:141-145`).
- Empty: "<owner> has no share links yet."; load error (`:273-285`).
- **Data:** `lib/useShareLinksAdmin.ts` → `shareUrlsFindForUserAdmin`, `shareUrlsFindForCampaignAdmin`, `shareUrlsUpdateLabelAdmin`, `shareUrlsDeleteAdmin`, `shareUrlsCreateDuplicateAdmin`; `lib/useCampaignsAdmin.ts` → `campaignFindAllAdmin`, `campaignCreateAdmin`; `imagesUploadImage`; `shared/lib/useActionsAdmin`; `lib/useExternalShareTargetsAdmin`; `sharedweb/ui/UserSelect` (`useSelectableUsers`).
- **Shared code:** `shared/lib/inviteUrls` (`getReferralSignupUrl`), `sharedweb/lib/{clipboard, config}`, `sharedweb/ui/{Button, Card, ToastProvider (confirm), UserSelect}`, `common/{plural, shareUrlLabel, invitePageDescription}`.
- **Tests:** `pages/ShareLinksPage.test.tsx` (users failed; non-archived actions offered; actions loading/failed/401/kept on refetch failure; external targets offered/loading/failed; campaign signup link on invite domain; creates and selects a campaign; campaign create failure and 401; image upload refusal; campaigns failed; lists links; links failed; lists created duplicate; renamed label; label refusal keeps editing; delete drops; duplicate refusal keeps label; delete failure keeps link), `components/share-links/shareLinkTargets.test.ts` (grouping and order), `lib/useCampaignsAdmin.test.ts`.
- **Notes:** campaigns can only be **created** here; renaming, picture and kind are edited on `/organizations` (organizations are campaigns of kind organization). An ordinary campaign's name or picture can't be changed anywhere in admin.

## `/custom-links` Custom Links → Growth › Links › Custom links (palette)

- **Purpose:** short URLs on the invite domain for flyers, QR codes and campaigns.
- **Page:** `pages/CustomLinksPage.tsx`.
- Create form: Label (max 200, placeholder "100k flyer"), Path (max 65, placeholder "/100k"), Destination (max 2048, URL or site path); all required; read-only while creating; validated by `customLinkFieldsSchema` (`common/customLinks`, rejects reserved paths) with the first issue shown as an alert; **Create link**; success clears (`:82-146`).
- Notes: paste a waitlist link to keep its organization and attribution; visits count every arrival; waitlist signups are reported under Organizations (`:77-80`, `:147-150`).
- Table: Label, Path (with **copy** button for `<invite base>/<slug>`, toasts "Link copied." / "Could not copy the link."), Destination, Visits; Label, Path and Destination are **inline-editable**, validated by the partial schema (toast on invalid), refusal toast keeps the edit (`:165-243`, `:50-70`).
- **Delete link** → ConfirmDialog "Delete this custom link? /<slug> will stop working. This cannot be undone."; stays open on failure (`:229-252`).
- Loading; error with **Retry**; "No custom links yet." (`:151-164`).
- **Data:** `lib/useCustomLinksAdmin.ts` → `customLinksFindAllAdmin`, `customLinksCreateAdmin`, `customLinksUpdateAdmin`, `customLinksRemoveAdmin`.
- **Shared code:** `common/customLinks`, `sharedweb/lib/{clipboard, config}`, `sharedweb/ui/{Button, ToastProvider}`.
- **Tests:** `pages/CustomLinksPage.test.tsx` (visit counts and create with full waitlist destination; reserved paths rejected client-side; duplicate path refusal keeps form; inline destination edit preserving query; failed edit stays visible with refusal; copies public URL; delete needs confirmation; load failure and retry; sidebar folder placement; reserved inline path edit rejected; failed delete keeps link and dialog; failed clipboard write reported).

## `/hosted-docs` Hosted Docs → Growth › Links › Hosted docs (palette)

- **Purpose:** public PDFs at `<invite domain>/docs/<ID>`.
- **Page:** `pages/HostedDocsPage.tsx`.
- Warning: anyone with the link can open them and search engines may index them (`:101-104`).
- Upload form: PDF file input; ID (max 104) **prefilled from the file name** (`hostedDocSlugFromFileName`) and **re-filled by a new file only while the ID is still the one it filled in**; Notes (max 2000, "Visible to admins only"); **Upload** (`:106-171`, `:129-137`).
- Validation: file required, must be `application/pdf`, ≤ 50 MB (`HOSTED_DOC_MAX_BYTES`), ID via `hostedDocFieldsSchema`; first problem shown as an alert (`:32-36`, `:108-118`).
- "The ID cannot be changed later. Views count every opening…" (`:177-180`).
- Table: ID (link opening in a new tab, **copy** button), Notes (**inline-editable**, `hostedDocNotesSchema`), Views, Uploaded (name or "Deleted admin", date-time), File replaced (same, or "—") (`:195-266`).
- **Replace file** (upload icon, PDF only, same checks) → ConfirmDialog "Replace this file? /docs/<id> will serve <file> within five minutes. The current file will be deleted. This cannot be undone." (`:89-94`, `:268-284`, `:301-312`).
- **Delete** → ConfirmDialog "Delete this document? /docs/<id> will stop working, and a new document can take its ID." (`:285-293`, `:313-321`).
- Loading; error with **Retry**; "No hosted docs yet." (`:181-194`).
- **Data:** `lib/useHostedDocsAdmin.ts` → `hostedDocsFindAllAdmin`, `hostedDocsCreateAdmin`, `hostedDocsReplaceFileAdmin`, `hostedDocsUpdateAdmin`, `hostedDocsRemoveAdmin`.
- **Shared code:** `common/hostedDocs`, `shared/lib/dateFormatters`, `sharedweb/lib/{clipboard, config}`, `sharedweb/ui/{Button, ToastProvider}`.
- **Tests:** `pages/HostedDocsPage.test.tsx` (lists views, uploader, replacement; ID prefill and upload; keeps a typed ID before or after choosing a file; keeps an ID typed after choosing when another file is chosen; follows the next file after a cancelled pick; follows the file while the ID is the filled one; invalid ID not sent; copies this environment's URL; inline notes; confirm before replace; confirm before delete).
- **Notes:** the explainer hardcodes "thealliance.org/docs/<ID>" while links use the environment's invite base URL (`:102`, `:38`).

## `/organizations` Organizations → Growth › Organizations (palette)

- **Purpose:** organizations (campaigns of kind organization), their group and their waitlist links.
- **Page:** `pages/OrganizationsPage.tsx`; `components/organizations/{OrganizationCard, OrganizationLinks}.tsx`.
- **New organization**: name and **Create** (disabled when blank or pending; input read-only while pending) → creates a campaign of kind organization (`:69-95`).
- **Existing campaign** select and **Make organization**, shown only when ordinary campaigns exist (`:97-133`).
- Each organization card (`OrganizationCard.tsx`):
  - **Logo**: click to upload an image (hover shows an upload icon); errors toast (`:39-44`, `:52-80`).
  - **Name**: inline-editable, saves on blur (`:82-93`).
  - **Group** select: "No group" or any community; **communities another organization owns are disabled** and labelled "(another organization's)" (`:95-124`; `OrganizationsPage.tsx:147-155`).
  - Amber note when no group: "People mobilized from this organization will await staff placement." (`:127-132`).
- **Waitlist links** per organization (`OrganizationLinks.tsx`):
  - Table: Channel (inline-editable), Link code (**click to copy** `waitlistLinkUrl`), Published (date input saving once **on blur** or Enter, only if changed), Created, Entries, Referral message (checkbox, saves at once), **Archive** / **Restore** (`:68-101`, `:176-260`). Archived rows are greyed.
  - **Archive** → ConfirmDialog "Archive this link? People who open the "<channel>" link will be told it is no longer active, and can join without it. Entries already attributed to it keep their attribution." **Restore** needs no confirmation (`:153-163`, `:246-256`).
  - **Add link**: channel (max 200), Published date (optional), "Show referral message" (default on) (`:103-152`).
  - Explainer of what "Show referral message" does (`:63-67`).
- Errors: first of campaigns, groups or links failing; loading; "No organizations yet." (`:47-54`, `:136-141`).
- **Data:** `lib/useCampaignsAdmin.ts` → `campaignFindAllAdmin`, `campaignCreateAdmin`, `campaignUpdateAdmin` (name, communityId, kind, picture), `useUploadCampaignPictureAdmin` (upload then update, refetch); `lib/useCommunitiesAdmin` → community list; `lib/useWaitlistLinksAdmin.ts` → `waitlistAdminFindLinksAdmin`, `waitlistAdminCreateLinkAdmin`, `waitlistAdminUpdateLinkAdmin`.
- **Shared code:** `common/waitlist` (`waitlistLinkUrl`), `shared/lib/dateFormatters`, `sharedweb/lib/{clipboard, config}`, `sharedweb/ui/{Button, Card, ToastProvider}`, `lib/dateInput`, `lib/isOrganization`.
- **Tests:** `pages/OrganizationsPage.test.tsx` (lists with links and missing-group note; create and make-organization; name locked while creating; group assignment excluding others' groups; add link and archive after confirming; create/update with referral message off; rename on blur; shows another edit's name and saves nothing on untouched blur; group refusal reason; publication date saved once on blur; channel rename restored on refusal; restore without confirming; logo upload saves key; logo upload failure reason; copy link and copy failure), `lib/useCampaignsAdmin.test.ts`.
- **Notes:** organizations sit in the **Waitlist** sidebar folder today, but PLACES gives them their own Growth place. Organizations can't be demoted back to ordinary campaigns or deleted.

---

## `/waitlist` Waitlist entries → Growth › Waitlist › Entries (palette)

- **Purpose:** search, segment, tag, mobilize and email waitlist entries.
- **Page:** `pages/WaitlistPage.tsx`; `components/waitlist/*`, `components/waitlist/email/*`; `lib/waitlistFilter.ts`, `lib/waitlistEmail.ts`, `lib/waitlistContact.ts`.

**Cohorts** (saved filters, `components/waitlist/CohortControls.tsx`)
- "Cohort" select: none or a saved cohort; choosing one applies its filter and **drops a search still being typed** (`:80-96`; `WaitlistPage.tsx:149-156`).
- When the applied cohort's filter differs from the current one: **Revert** and **Update cohort to this filter** (ConfirmDialog "This replaces its saved filter with the current one.") (`:97-118`, `:139-146`).
- **Save filter as cohort**: inline name form (max 100); taken names keep the typed name (`:64-76`, `:119-127`).
- **Delete cohort** (ConfirmDialog "This deletes the saved filter. No entry or tag changes.") (`:128-138`, `:147-154`).
- Toasts "Saved cohort …", "Updated cohort …".

**Filters** (`components/waitlist/WaitlistFilters.tsx`)
- Search name, email or phone (max 200), **debounced 300 ms** (`:69-79`, `:104-112`).
- Multi-select menus (`MultiSelectFilter.tsx`): **Organization**, **Link** (labelled with organization), **Invite** (No invite, Unused, Claimed, Revoked), **Spam** (Clean, Suspected spam, Spam, Not spam), **Tag**. Each shows a summary; selected ids that no longer exist show "N not found" with **Remove N not found**; "Not loaded" / "None yet" (`:113-148`; `MultiSelectFilter.tsx:23-85`).
- **Contact**: any, Email, Phone (`:149-166`).
- **Mobilized** (Mobilized / Waiting), **Subscription** (Subscribed / Unsubscribed), **Reason** (Has reason / No reason) tri-state selects (`:30-52`, `:89-100`, `:167-174`).
- **Joined** from/to date inputs, inclusive (end of day) (`:175-200`).
- **Referred by** chip when filtering by referrer, with clear (`:201-216`).
- **Clear filters** icon when the filter differs from the default (`:217-230`).
- **Default filter hides spam-like entries** (Suspected spam and Spam unchecked) (`lib/waitlistFilter.ts:114-118`).
- Any filter change resets to page 1 and clears the selection (`WaitlistPage.tsx:98-105`).

**Count, selection and bulk actions**
- "N entries" total, "N entries are selected" (`WaitlistPage.tsx:168-179`).
- **Select all N matching** (server returns every matching id); ignored if the filter or selection changed meanwhile; disabled while previous-filter rows show (`:180-198`, `:84-96`; `useFindWaitlistEntryIdsAdmin`).
- **Clear selection** icon (`:199-209`).
- **Add tag** menu: existing tags, or **New tag…** (inline name form, creates then tags; form closes once the tag exists even if tagging fails; taken names keep typed name) (`TagActions.tsx:52-93`).
- **Remove tag** menu → ConfirmDialog "Removes the tag from any of the N selected entries that have it." (`TagActions.tsx:94-126`).
- **Manage tags** dialog (disabled until tags load): each tag inline-renamable with its entry count; **Delete** → ConfirmDialog "This removes the tag from N entries. The entries themselves stay on the waitlist." (`TagManager.tsx`).
- Five bulk buttons, each disabled with no selection and each with its own ConfirmDialog acting on **the entries selected when it opened** (`EntryActions.tsx:19-126`):
  - **Mark mobilized** ("…sends no email and issues no invite; use it for people accepted outside the app. Entries already mobilized keep their date.").
  - **Undo mobilized** ("…Any invite already sent stays usable; revoke it separately…").
  - **Revoke invites** ("Revoke the unused signup invites…; the next email with the signup-link placeholder sends a new invite. An invite in an email being sent right now is kept.").
  - **Mark as spam** ("They get no more email, drop out of the public waitlist count, and are hidden by the default spam filter.").
  - **Mark as not spam** ("…The confirmation email they missed is not sent…").
  - Success toasts with counts; any success clears the selection; failure keeps it and toasts the reason.
- **Metrics** toggle (pressed state) shows the metrics panel for the current filter (`WaitlistPage.tsx:221-247`).
- **Compose email** opens the composer (disabled while one is open) (`:234-243`).

**Metrics panel** (`components/waitlist/WaitlistMetrics.tsx`)
- Waiting, Mobilized, Invite claimed (n of N, %), Invite claims, Emailed an invite, Emailed then claimed (%), Median email to claim (formatted elapsed, "of N entries") (`:111-132`).
- Tables: **By source** (Organization, Channel, Published, Entries, Claims), **By week** (UTC, from Monday: Week of, Entries, Claims), **Claimed invites by destination group** (Organization, Group, Claims, Contract signed %, First action %) (`:134-170`). Empty tables say "none". Refreshes after mobilizing.

**Table** (`components/waitlist/WaitlistTable.tsx`)
- Columns: select checkbox (header checkbox selects the page, **indeterminate** when partial; disabled while previous rows show), Person (name, email or formatted phone, "Unsubscribed", contact actions), Reason (2-line clamp, full in tooltip), Nonprofit nominations, **Organization (sortable)**, Link (channel), Referrer (**click to filter to entries they referred**), **Joined (sortable)**, Tags, Mobilized (date or "Waiting"), Invite state, Account created (Yes/No), Contract history (each Signed/Suspended with date-time, or "No contract events"), Spam toggle (`:127-283`).
- Sort cycles desc/asc; first click on Organization sorts A→Z, on Joined newest first; resets to page 1 (`:31-87`). Default newest first.
- Spam-like rows are greyed (`:186`).
- **Row contact actions** (`EntryContactActions.tsx`): **Referral link** dialog (waitlist share URL with copy and "Copied"/"Couldn't copy" feedback) (`:176-217`); **Signup invitation** dialog (warns if already claimed, unsubscribed or spam-like; **Get signup invitation** issues or reuses one; shows the link to copy, "Issued a new invitation" / "Reused…", and a placement warning for no organization, no group or full group; stays open even if a refetch drops the entry) (`:90-153`; `WaitlistPage.tsx:261-263`); **Mark unsubscribed** for subscribed phone entries only, ConfirmDialog "…there is no way to undo this here." (`:194-225`).
- **Row spam toggle** (`SpamToggle.tsx`): marks spam / not spam at once, no confirmation; drops the entry from the selection.
- Pagination 50 per page, shown when total > 50; moves back to the last page when entries leave it; previous rows dimmed while loading (`WaitlistPage.tsx:54`, `:128-132`, `:267-300`).
- "No entries match."; first failing load named (entries, campaigns, links, tags, cohorts) (`:133-142`, `:265`).

**Email composer** (`components/waitlist/email/EmailComposer.tsx`)
- Opens empty, or **prefilled from a draft passed by `/waitlist-emails`** ("Use again"), clearing that navigation state so Back or reload doesn't reopen it (`WaitlistPage.tsx:71-82`).
- "Email N selected"; **Discard** asks ConfirmDialog when subject or body has text (`:103-127`).
- **Templates** (`EmailTemplateControls.tsx`): **Use template** menu (asks "Replaces the subject and body you have written." if the draft is unsaved; switches freely while unedited or cleared); **Update template** when the draft differs from the loaded one (ConfirmDialog; subject whitespace ignored); **Save draft as template** (inline name, max 100; disabled for blank drafts or unknown placeholders); **Delete template** (ConfirmDialog "Emails already sent from it keep their content.").
- Subject (max 200) and Body in Markdown (max 20,000) (`:129-146`).
- **Insert** buttons for each placeholder: name, organization name, signup link, personal share link; inserts **at the cursor** and keeps the caret after it (`:77-96`, `:147-158`; `common/waitlistEmail.ts:3-7`).
- **Include people who already claimed an invite** checkbox (`:159-166`).
- Unknown placeholders listed in red and block preview (`:51-54`, `:168-172`).
- **Preview**, debounced 400 ms, for the selection (`:46-64`; `EmailPreviewPanel.tsx`): "N of M selected would get this email, skipping …"; blocking problems (everyone skipped; organization-name placeholder for recipients without one); warnings (recipients without organization, without group, in a full group; already sent this subject; claimed recipients getting a new invite; mobilizing without a signup link); **Previous/Next recipient** stepping through recipients; the sample's subject and a **sandboxed iframe** of the HTML; a recipient missing a value is named; note that the signup link shown is a sample (`lib/waitlistEmail.ts:42-105`).
- **Send test to me** → ConfirmDialog (sends with the sampled recipient's details and sample links) (`EmailSendActions.tsx:101-136`).
- **Send email** and **Send email and mark as mobilized**, each enabled only when a preview matches the current draft and selection and nothing blocks; ConfirmDialog with a generated summary; sends to the entries selected when it opened; **a retried send reuses its request id**, so a send whose answer was lost isn't made twice; success toasts "Sending to N recipients. Follow it under Waitlist emails." and clears the selection (`EmailSendActions.tsx:50-161`).

- **Data:** `lib/useWaitlistEntriesAdmin.ts` → `waitlistAdminSearchEntriesAdmin` (filter, sort, offset, limit), `waitlistAdminFindEntryMetricsAdmin`, `waitlistAdminFindEntryIdsAdmin`, entry change endpoints (mark/undo mobilized, revoke invites, spam), `waitlistAdminInviteEntryAdmin`, `waitlistAdminUnsubscribeEntriesAdmin`; `lib/useWaitlistTagsAdmin.ts` → `waitlistAdminFindTagsAdmin`, `waitlistAdminCreateTagAdmin`, tag add/remove, `waitlistAdminRenameTagAdmin`, `waitlistAdminDeleteTagAdmin`; `lib/useWaitlistCohortsAdmin.ts` → `waitlistAdminFindCohortsAdmin`, `…CreateCohortAdmin`, `…UpdateCohortAdmin`, `…DeleteCohortAdmin`; `lib/useWaitlistEmailsAdmin.ts` → `waitlistEmailAdminPreviewEmailAdmin`, `…SendTestEmailAdmin`, `…SendEmailAdmin`; `lib/useWaitlistEmailTemplatesAdmin.ts` → `waitlistEmailAdminFindTemplatesAdmin`, `…CreateTemplateAdmin`, `…UpdateTemplateAdmin`, `…DeleteTemplateAdmin`; `lib/useCampaignsAdmin`; `lib/useWaitlistLinksAdmin`.
- **Shared code:** `common/{plural, waitlist, waitlistEmail}`, `shared/lib/{dateFormatters, inviteUrls}`, `sharedweb/lib/{clipboard (copyOutcome), config}`, `sharedweb/ui/{Button, DropdownMenu, Modal, Pagination, ToastProvider}`, `@base-ui/react/menu`, `components/{ConfirmDialog, FormTextarea, InlineTextInput}`.
- **Tests:** `pages/WaitlistPage.test.tsx` (newest first with total; referrer and status filters; metrics for filter; metrics refresh after mobilizing; referrer chip clear; paging and reset on filter; clears typed search; debounced search; organization sort from page 1; load failure; invite state toggle; inclusive join range; organization and link filters; mark mobilized; select all matching across pages and undo; revoke invites; revoke failure with no reason; indeterminate page checkbox; selection cleared on filter change; stale select-all answers ignored for changed filter or selection; acts on selection at confirm time; back to last page; failure keeps selection; selection disabled on stale rows; contact method filter), `WaitlistPage.cohorts.test.tsx`, `WaitlistPage.email.test.tsx` (preview and send; selection at confirm time; request id reuse and survival; waits for current preview after draft or selection change; include claimed; repeat-send count refresh; send stays off while post-failure preview fails; discard confirm; sample link note; mobilize without signup link warning; organization-name block; warnings and missing values; unknown placeholders; insert at cursor and keep position; step recipients; test send; passed draft opens and clears), `WaitlistPage.emailTemplates.test.tsx`, `WaitlistPage.invitation.test.tsx`, `WaitlistPage.spam.test.tsx` (spam hidden by default; greyed rows and per-row toggle; bulk spam/not spam; toggled entry leaves selection), `WaitlistPage.tags.test.tsx` (show, tag, untag; create; rename and delete; filter by tag; rename refusal; new-tag form closes once the tag exists; stale tag filter removal; taken name; delete refusal; dialog shut until tags load), `WaitlistPage.testHarness.test.tsx` (harness only), `components/waitlist/{EntryContactActions, WaitlistMetrics, WaitlistTable}.test.tsx`.
- **Notes:** the richest page in the group, with no URL state: a reload loses the filter, page, sort, selection and an unsent draft (there's no leave guard on the composer).

## `/waitlist-emails` Waitlist emails → Growth › Waitlist › Emails (palette)

- **Purpose:** history and delivery status of waitlist email batches, with retry and reuse.
- **Page:** `pages/WaitlistEmailsPage.tsx`; `components/waitlist/email/{EmailBatchDetail, EmailRetryActions}.tsx`.
- List of batches: subject, created date-time, staff name, "Marks mobilized"; counts by status (Sent, Pending, Sending, Failed, Uncertain, Skipped) where non-zero (`:30-63`).
- **Click to expand one batch at a time** (`aria-expanded`) (`:10`, `:34-44`).
- Expanded (`EmailBatchDetail.tsx`): **Use again as a new draft** → navigates to `/waitlist` with the subject and body as a draft (`:37-47`); the body as sent (`:50-52`); recipients table: name and contact, status, detail (skip reason: no email, unsubscribed, already claimed, spam; or "Sent <time>"; or the error) (`:20-25`, `:59-89`).
- **Retry** (`EmailRetryActions.tsx`): **Retry N failed recipients** (ConfirmDialog "…Recipients it reached don't get it again."); **Resend uncertain** or **Resend failed and uncertain** (ConfirmDialog warning they could get it twice); hidden when nothing failed or is uncertain; toasts.
- **Polling:** the list and an open batch refetch every **3 s** while any batch is in progress (`lib/useWaitlistEmailsAdmin.ts:31-46`; `lib/waitlistEmail.ts:183`).
- Loading, error, "No emails yet. Send one from the waitlist." (`:17-27`).
- **Data:** `lib/useWaitlistEmailsAdmin.ts` → `waitlistEmailAdminFindEmailsAdmin`, `waitlistEmailAdminFindEmailAdmin`, `waitlistEmailAdminRetryEmailAdmin`.
- **Tests:** `pages/WaitlistEmailsPage.test.tsx` (counts and recipients; retry after confirming; cancel retries nothing; uncertain double-send warning; use again as draft; list and open batch refresh while sending; uncertain-only resend; retry refusal keeps offering it).

---

## `/ambassador-program` Ambassador Program → Growth › Ambassador program (palette)

- **Purpose:** a small CRM of invited and active ambassadors, their dated interactions and invite goals.
- **Page:** `pages/AmbassadorProgramPage.tsx`; `components/ambassador-program/*`.
- **Filter records** search over name, email and tag names (client-side) (`:33-45`, `:115-121`).
- Totals: Invited, Active, Interactions (unfiltered) (`:124-144`).
- **Projected growth** (`GrowthProjectionPanel.tsx`): "Active goal target left" (sum of active participants' current goal targets minus successful), then one card per projection checkpoint "By <date>: N"; "Updated <time>"; empty text; the calculation explained (`:22-91`). Uses the **filtered** active list.
- Two sections, **Invited** and **Active participants**, each with a count (`ProgramSectionPanel.tsx`, `programSection.tsx`):
  - **Add**: search the member pool, select (up to 40 matches, excluding members already in that section), **Add invited member** / **Add participant** (`ProgramSectionPanel.tsx:12-82`).
  - Member card: avatar, name linking to `/member/:id`, email, Ambassador badge and tags; **Remove invited** / **Remove participant** (no confirmation) (`ProgramMemberCard.tsx:97-140`).
  - **Add interaction**: note and date (default today), **Add entry** disabled when blank; trimmed (`ProgramMemberCard.tsx:46-95`).
  - Interactions list, dated (`:152-176`).
  - Active participants only: **Ambassador invite goals** (`InviteGoalStatsPanel.tsx`): totals (created, accepted, successful, goal periods), current goal (period, target, created, accepted, successful/target) or "No current ambassador invite goal.", collapsible **Past growth periods (N)** and **Upcoming goals (N)**.
- All add/remove/interaction controls disabled while any mutation runs; one generic error banner for any load or save failure (`:64-67`, `:98-155`); dimmed while loading.
- **Data:** `lib/useAmbassadorProgramAdmin.ts` → `userGetAmbassadorProgramAdmin`, `userUpsertAmbassadorProgramMemberAdmin`, `userUpdateAmbassadorProgramMemberAdmin`, `userCreateAmbassadorProgramInteractionAdmin`; `lib/useGraphUsersAdmin` → `userListForGraphAdmin` (member pool).
- **Shared code:** `shared/lib/dateInput`, `sharedweb/ui/Avatar`, `shared/styles/util`.
- **Tests:** `pages/AmbassadorProgramPage.test.tsx` (pool minus the section's members; pool search narrows picker; trimmed interaction on chosen date; past interactions listed; invite goals and remaining target for active participants).
- **Notes:** goals are only displayed; there's no UI here to create or edit an invite goal. Interactions can't be edited or deleted. Removal has no confirmation. The error banner doesn't say what failed.

## `/outreach-partnerships` Outreach Partnerships → Growth › Outreach partnerships (rail: Partnership responses; PLACES tabs: Pending response, All)

- **Purpose:** review organizations' partnership form responses and keep internal follow-up notes.
- **Page:** `pages/OutreachPartnershipsPage.tsx`.
- Count line: "No responses yet" / "1 response" / "N responses" (`:53-62`).
- Response card: organization name, website (linked, `ensureHttpProtocol`), submitted date-time, contact email (`mailto:`), person name; How they can share (channels), Audience size, Other sharing details, What they want members to do, Other notes (optional blocks hidden when empty) (`:207-268`).
- **Delete** → `window.confirm("Are you sure you want to delete <org>'s outreach partnership response? This cannot be undone.")`; "Deleting..." per card; double clicks ignored; a 404 drops it (`:105-133`, `:239-246`).
- **Internal notes** list, dated (`:271-284`, `:338-349`).
- **Add note**: datetime-local (default now) and textarea; **Save note**, "Saving..." per card; empty → "Write a note before saving."; success clears and resets the date; a note a refetch already returned isn't duplicated (`:90-103`, `:286-314`; `lib/useOutreachPartnershipResponsesAdmin.ts:49-65`).
- One page-level error line; load failure beside cached data; loading; empty state (`:146-157`).
- **Badge link:** the sidebar's count is responses with no notes; adding the first note clears it from the badge.
- **Data:** `lib/useOutreachPartnershipResponsesAdmin.ts` → `actionPartnershipsFindAllResponsesAdmin`, `actionPartnershipsCreateNoteAdmin`, `actionPartnershipsDeleteResponseAdmin`.
- **Shared code:** `common/url`, `shared/lib/hey-api`, `sharedweb/ui/{Button, DateTimePicker}`.
- **Tests:** `pages/OutreachPartnershipsPage.test.tsx` (lists; saved note clears field; no duplicate note after early refetch; save refusal keeps note; empty note asks; delete removes; delete survives an earlier-started refetch; delete failure keeps it; 404 drops; load failure vs none; 401; keeps responses beside refetch error).
- **Notes:** there's **no pending/all filter today**; PLACES' "Pending response" tab is new. Notes can't be edited or deleted. Uses `window.confirm`.

---

## `/action-updates` Action Updates → Content › Task updates (palette; each also in its task's Messages tab)

- **Purpose:** every action's updates in one list, grouped by status.
- **Page:** `pages/ActionUpdatesPage.tsx`.
- Groups in order **Draft**, **Scheduled**, **Published**, each "· N updates", empty groups hidden (`:15-19`, `:76-87`, `:108-137`); status from `lib/actionUpdateStatus`.
- Columns: Title (link to `/actions/:actionId/updates/:updateId`, "Untitled update"), Action (link to `/actions/:actionId`, or "Action #id"), Date, Status badge (Scheduled shows "Publishes <date-time>"), Notification ("Notified <date-time>" or "—") (`:27-72`).
- Says to create updates from an action's Updates tab (`:94-97`). No create, edit or filter here.
- **Data:** `lib/useAllActionUpdatesAdmin.ts` → `actionUpdatesAllUpdatesAdmin`.
- **Tests:** `pages/ActionUpdatesPage.test.tsx` (groups into drafts, scheduled, published).

## `/general-updates` General Updates → Content › General updates (palette)

- **Purpose:** list of general updates by schedule state.
- **Page:** `pages/GeneralUpdatesPage.tsx`; `components/GeneralUpdateCard.tsx` (also used on suite pages).
- **New General Update** → `/general-updates/new` (`:66-72`).
- "N total updates" (`:74-76`).
- Groups **Draft** (no start date), **Active** (started, not ended), **Scheduled** (future start), **Expired** (ended), empty groups hidden (`:23-59`).
- Card: name, Start, End, suites ("Suite: a, b"); **click opens** `/general-updates/:id` (`GeneralUpdateCard.tsx:28-49`).
- Loading; load error (refusal and 401 aware); error beside cached data; "No general updates found." (`:46-52`, `:78-82`).
- **Data:** `lib/useGeneralUpdatesAdmin.ts` → `generalUpdatesAllGeneralUpdatesAdmin`.
- **Tests:** `pages/GeneralUpdatesPage.test.tsx` (groups by schedule; failure vs none; 401; keeps updates beside refetch error).
- **Notes:** no delete or archive anywhere for general updates.

## `/general-updates/:id` (and `/general-updates/new`) → Content › General updates › General update record (palette)

- **Purpose:** create or edit a general update's details, audience and content.
- **Page:** `pages/GeneralUpdatePage.tsx`; `components/general-update/{GeneralUpdateScheduleFields, GeneralUpdateAudienceFields, generalUpdateForm}.tsx`; `components/FormBuilder` (displayOnly); `components/useContentConfirm.tsx`.
- `:id` of `new` (or missing) creates; `?suiteId=` on new **preassigns that suite** (`:52-54`, `:99-106`).
- **Tabs** (existing only), in URL `?tab=details|content` (`lib/useSearchParamTab.ts:9-16`): "General update details", "Content" (`:310-337`).
- **Details form:**
  - Title (required) (`:158-175`).
  - Priority: **Manage priority** link to `/priority` (plain `<a>`) (`:177-184`).
  - **Suites**: chips with remove; "Add a suite..." select of unassigned suites; loading/failed/none states; with any suite, dates are **inherited** and the Schedule section hides (`GeneralUpdateScheduleFields.tsx:42-104`).
  - **Schedule** (no suite): Start and End datetime-local (`:106-154`).
  - **Participating Tags**: checkbox grid with public display names; note that untagged updates show to nobody unless the manual cohort is on (`GeneralUpdateAudienceFields.tsx:50-101`).
  - **Manual User Cohort**: Enable checkbox (count shown), then a multi `UserSelect`; disabling clears it (`:103-143`).
  - **Cancel** (back to list) and **Create general update** / **Save changes**, disabled while saving (`:199-221`).
- **Content check on save:** `useContentConfirm` opens "Save anyway?" listing absolute links to the site (should be paths) and mentions of "worldalliance" (`useContentConfirm.tsx:191-238`; `GeneralUpdatePage.tsx:132`).
- Create navigates to the new record; failure shows "Failed to save general update" (`:133-142`).
- **Content tab:** the block editor (`FormBuilder displayOnly`) with snapshot id, saving through `saveSchema`; if the stored content can't be parsed by this build, an amber alert "This update can't be edited here" instead (`:259-287`). The builder's capabilities belong to the forms inventory.
- Fills the form only from a fetch made after mount (not a stale cache) (`:72-93`).
- Loading; "General update not found" (404) or "Failed to load general update" with **← Back** (`:225-253`); **← Back to general updates** in the header (`:295-300`).
- **Data:** `lib/useGeneralUpdateAdmin.ts` → `generalUpdatesFindOneGeneralUpdateAdmin`, `generalUpdatesCreateGeneralUpdateAdmin`, `generalUpdatesUpdateGeneralUpdateAdmin` (details and schema); `lib/useActionSuitesAdmin`; `lib/useTagsAdmin`; `sharedweb/ui/UserSelect` (`useSelectableUsers`).
- **Shared code:** `common/forms/display-only-schema`, `shared/lib/hey-api`, `sharedweb/ui/{DateTimePicker, UserSelect}`, `components/FormSection`.
- **Tests:** none for this page; `components/useContentConfirm.test.tsx` covers the content check (nested strings, excerpts, emoji cuts, dedupe, site links on either domain, link vs worldalliance precedence, destination parsing, CommonMark vs GFM, replace resolves earlier call false, sectioned message).
- **Notes:** no leave guard on the details form. Tag and suite pickers are duplicated in the action editor.

## `/posts/:postId?` Forum Posts → Content › Forum posts, post open in the side sheet (palette)

- **Purpose:** per-post forum settings: authors, Q&A, notifications, cluster tags, comment tags, export.
- **Page:** `pages/PostsManagement.tsx`.
- Posts list: title, "by <author>", badges "Q&A mode active", "Reply notifications on", "Cluster tags on", "N authors" (> 1), "N expert(s) assigned"; selected highlighted; **selecting puts the id in the URL** and `/posts/:id` preselects it (`:67-81`, `:114-124`, `:211-268`).
- **Post settings** for the selected post (`:270-435`):
  - **Authors** multi `UserSelect` (all are notified of new comments).
  - **Enable Q&A mode**; when on, **Expert badge label** (max 64, default "Expert") and **Designated experts** multi `UserSelect`.
  - **Notify for replies**.
  - **Show cluster tags**.
  - **Comment tags**: editable list, **Add tag**, remove per tag; names trimmed, blanks dropped, **duplicates refused** ("Tag names must be unique within a post"); tags sent only if changed (with known ids); **deleting a saved tag asks a fullscreen confirm** "Delete "x"? Comments filed under that tag lose their label. This cannot be undone." (Delete / Keep) (`:126-157`, `:347-404`).
  - **Download as .html**: the post, comments and attachments as one page, filename from Content-Disposition or `post-<id>.html`; "Preparing..."; error toast (`:83-112`, `:406-418`).
  - **Save changes**, "Saving..."; toast "Post updated"; refusal toast (`:158-181`, `:420-428`).
- "Select a post from the list to configure settings." Loading; load failure (`:184-198`).
- **Data:** `lib/usePostsAdmin.ts` → `forumGetPostsForAdmin`, `forumUpdatePostSettingsAdmin`; `forumExportPostAdmin` (blob); `lib/useUsersAdmin`.
- **Shared code:** `common/errorMessage`, `sharedweb/ui/{Button, Card, ToastProvider (ConfirmMode.Fullscreen), UserSelect}`, `shared/styles/card`.
- **Tests:** `pages/PostsManagement.test.tsx` (user list failure; quiet when refetch fails after load; posts failure; lists saved settings; save refusal; 401 on save).
- **Notes:** no create, delete or moderation of posts or comments here. Unsaved settings are lost on selecting another post without warning. The MemberZoneLink maps `/posts/:id` to `/forum/post/:id`.

## `/image` Image Upload → Content › Media › Images (upload button) (palette)

- **Purpose:** upload an image to get a public URL.
- **Page:** `pages/ImageUpload.tsx`.
- File input (any type), **Upload** (`imagesUploadImage` with a data URL); shows the image and its URL; refusal message on failure (`:12-69`).
- **Tests:** `pages/ImageUpload.test.tsx` (refusal reason).
- **Notes:** no list of past images, no copy button, no accept filter, Upload isn't disabled with no file or while uploading, `console.log(data)` left in (`:33`). PLACES' "Media › Images" implies a library that doesn't exist today.

## `/videos` Videos → Content › Media › Videos (palette)

- **Purpose:** list uploaded videos and delete them.
- **Page:** `pages/VideoManagement.tsx`.
- Table: Filename, ID, Size (B/KB/MB/GB), Created; **row click opens** `/videos/:id` (`:89-127`).
- **Delete** (×) → confirm toast "Delete video <id>? It disappears from the app, but its files stay in storage, so a direct link someone already copied keeps playing it."; error toast; a 404 drops it (`:29-56`, `:115-121`).
- Loading; failure vs none; 401; error beside cached list; "No videos found." (`:58-88`).
- **Data:** `lib/useVideosAdmin.ts` → `videosListVideosAdmin`, `videosDeleteVideoAdmin`.
- **Tests:** `pages/VideoManagement.test.tsx` (lists; delete removes; delete failure keeps; 404 drops; delete survives earlier refetch; failure vs none; 401; keeps list beside refetch error).
- **Notes:** no upload here (videos arrive through forms).

## `/videos/:videoId` Video detail → Content › Media › Video record (palette)

- **Purpose:** inspect a video's processing output and replace its HLS content.
- **Page:** `pages/VideoDetail.tsx`; `components/VideoReplaceForm.tsx`.
- **← Back** to `/videos`; filename and id (`:58-70`).
- Player (`sharedweb/forms/VideoPlayer`) (`:74`).
- **Video Info**: original size, output size, MIME type, created, updated (`:77-91`).
- **HLS Segments** table (filename, size; scrollable) with total (`:94-129`).
- **Replace Video Content**: a suggested ffmpeg command, multi-file input (`.m3u8,.ts`), "N files selected", **Replace Video Content**; requires at least one `.m3u8` ("At least one .m3u8 playlist file is required"); success toast and refresh of the segments; upload session-expired message (`:132-141`; `VideoReplaceForm.tsx:13-80`).
- "Video not found." (404), refusal and 401 messages; error beside cached data (`:29-53`).
- **Data:** `lib/useVideosAdmin.ts` → `videosGetVideoDetailsAdmin`, `videosReplaceVideoAdmin`.
- **Tests:** `pages/VideoDetail.test.tsx` (shows video; 404; failure vs not found; 401; keeps video beside refetch error; new segments after replace), `components/VideoReplaceForm.test.tsx` (refreshes only once accepted; sends nothing without a playlist).
- **Notes:** no delete on the detail page (only in the list). Replacing has no confirmation.

---

## `/event-log` Event Log → Activity › Event log, streams new events (palette)

- **Purpose:** paginated, filterable log of system events, with new ones streaming in live.
- **Page:** `pages/EventLogPage.tsx`.
- **Event type** filter (9 types, see Notes) and **Reset filter**; resets to page 1 (`:19-29`, `:139-167`).
- Table: Type (coloured pill), Message, User (link to `/member/:id` or "-"), Time (relative: s/m/h/d ago), Data (**Show/Hide** expands the JSON blob in a row below) (`:194-277`).
- **Live:** new events from the `/event-log` socket are prepended, **only on page 1 with no filter**, highlighted blue for 5 s; cleared on page or filter change; deduped against fetched rows (`:86-133`).
- Pagination 50 per page with "N total" when > 1 page; previous page dimmed while loading (`:280-289`; `lib/useEventLogAdmin.ts:6`).
- Loading; "Failed to load events." with **Retry**; "No events found." (`:170-186`).
- **Data:** `lib/useEventLogAdmin.ts` → `eventLogFindAllAdmin({page, limit, eventType})`; `lib/useEventLogWebSocket.ts` (`event-log-new`).
- **Shared code:** `sharedweb/ui/Pagination`, `common/duration`.
- **Tests:** `pages/EventLogPage.test.tsx` (lists and reloads for the chosen type).
- **Notes:** the filter offers 9 of the server's 17 `EventType`s (`shared/client/types.gen.ts:1730`); missing: `sms_resubscribe`, `forum_reply_notif_failure`, `action_opt_out`, `account_deletion_requested`, `account_deleted`, `join_request`, `waitlist_mail_cap_reached`, `phone_number_moved`. Those events still appear unfiltered (grey pill), but can't be filtered to. No connection indicator here (the invite feed has one). Relative times don't tick.

---

## `/kora-participants` Kora participants → Research › Kora participants (palette)

- **Purpose:** run the Safer Chatbots for Children (KORA) review project: status, transcript batches, notifications, results, and participants.
- **Page:** `pages/KoraParticipantsPage.tsx`; `components/{KoraProjectStatusControl, KoraBatches, KoraBatchActions, KoraBatchClosesAt, KoraBatchEvents, KoraConversations, KoraNotify, KoraResults, SortHeader}.tsx`; `lib/koraParticipants.ts`.
- **[export csv]** of participants and abandoned signups (with a status column, formula-escaped, BOM, `kora-participants-YYYY-MM-DD.csv`); disabled when both are empty (`:123-129`, `:152-165`; `lib/koraParticipants.ts:104`).
- **Project status** (`KoraProjectStatusControl.tsx`): segmented radio Pending ("Waitlist period, notify about launch"), Active ("Accepting reviews"), Closed ("Sign-up closed, thank participants"); **Active disabled until transcripts exist**, with the reason; each change asks a ConfirmDialog describing its effect; toast "Project is now X" (`:15-125`).
- **Transcripts** (`KoraBatches.tsx`):
  - Batch table: Uploaded, Transcripts, Per assignment, Reviews each, **Closes on (editable date, min today, Save appears when changed; saved as 23:59 local)**, Status ("Assigning" or "Retired <date>"), **Preview** (random transcript, to `/kora-participants/preview/:batchId`), actions (`:187-234`; `KoraBatchClosesAt.tsx`).
  - **Retire** → ConfirmDialog (warns when it's the last batch being assigned; ratings stay in the export marked retired; can reactivate); **Reactivate** at once; **Delete** only with feature flag **`KoraStagingTools`**: first counts the impact ("Counting…"), then a destructive ConfirmDialog with transcript, rating and assignment counts (`KoraBatchActions.tsx:36-175`).
  - **Upload** form: transcripts file (.jsonl/.json/.yaml), Transcripts per assignment (1–100, default 10), Reviews per transcript (1–50, default 5), Closes on (required, min today, 23:59 in the browser's time zone); missing file message; success "Read N transcripts." with a preview link; **rejected lines listed by number with their problems** (`:63-162`).
  - **History** (`KoraBatchEvents.tsx`): Show All / Batch actions / Rating submissions; rows for upload, retire, reactivate, delete (who, which batch, counts) and assignment completed (reviewer id prefix, ratings, **View its export** link to `/kora-participants/assignments/:id` unless deleted).
- **Conversations** (`KoraConversations.tsx`): every uploaded conversation, newest batch first: id, category label (`kora-review/categories`), uploaded, reviews "n of target", median, fastest, slowest review time.
- **Notify the waitlist** and **Tell earlier reviewers there's more** (`KoraNotify.tsx`): how many are waiting; button "Notify N participants/reviewers", **disabled unless the project is Active and someone is waiting** (with the reason); ConfirmDialog ("Messages can't be recalled once sent."); toast "Sending to N …".
- **Results for KORA** (`KoraResults.tsx`): **Download reviews (.jsonl)** and **Download KORA export (.json)** ("rolling"), each "Preparing…"; profile and exit-survey answer **counts only** (no individual answers) with respondent totals.
- Totals: Participants; People who abandoned signup, "N came back" (`:183-197`).
- **Signups per day (UTC)**, newest first (`:199-215`).
- **Search** by name, email or phone (case-insensitive, phone formatting ignored for numeric queries), filtering both tables (`:69-85`, `:217-225`).
- **Participants** table: Name, Email or phone, Sign-in methods (code method then Google/Apple), Time zone, Signed up; **sortable** Name, Contact, Signed up (default newest first); **Delete** → ConfirmDialog (deletes account, reviews, profile answers, related abandoned signups, signs out everywhere) (`:227-294`, `:130-137`).
- **Abandoned signups** table: contact, verified with, verified, status (Came back / Abandoned); **Delete** → ConfirmDialog (`:296-351`, `:138-146`).
- Deleting an already-deleted record counts as deleted; failures toast and refresh (`lib/useKoraParticipantsAdmin.ts:30-34`).
- **Data:** `lib/useKoraParticipantsAdmin.ts` → `koraAdminOverview`, `koraAdminDeleteParticipant`, `koraAdminDeleteAbandonedSignup`, `koraAdminProject`, `koraAdminUpdateProject`, `koraAdminNotifyWaitlist`, `koraAdminNotifyMore`; `lib/useKoraBatchesAdmin.ts` → `koraBatchesList`, `koraAdminConversations`, `koraBatchesUpload`, `koraBatchesSetClosesAt`, `koraBatchesRetire`, `koraBatchesReactivate`, `koraBatchesDelete`, `koraBatchesDeletionImpact`, `koraBatchesEvents`; `lib/useKoraResultsAdmin.ts` → `koraResultsAnswers`, `koraResultsExports`, `koraResultsKoraExport`.
- **Shared code:** `common/{kora, features, plural}`, `sharedweb/lib/{downloadBlob, config (isFeatureEnabled)}`, `sharedweb/ui/{Button, ToastProvider}`, `kora-review/categories`, date-fns.
- **Tests:** `pages/KoraParticipantsPage.test.tsx` (totals, newest first, search; sort by name; delete participant and abandoned signup after confirming; already-deleted treated as deleted; failed delete reports, closes, refreshes; empty vs table; load failure), `components/KoraBatches.test.tsx` (empty explanation; upload with settings then preview; asks for file; rejected lines; closing date saved as end of day), `components/KoraBatchActions.test.tsx` (retire confirm and last-batch warning; no warning with another assigned; failed retire; reactivate at once; delete after impact; history newest first and filter; history failure and empty), `components/KoraConversations.test.tsx`, `components/KoraNotify.test.tsx` (confirm before send; held until active; nothing to send; start failure; "more" count), `components/KoraProjectStatusControl.test.tsx` (Active disabled and why; close after confirm; cancel; failure; load failure), `components/KoraResults.test.tsx` (counts only; one export per line), `lib/koraParticipants.test.ts`.
- **Notes:** a whole project-operations console sits on one long page; PLACES splits it into Participants and Assignments.

## `/kora-participants/assignments/:assignmentId` → Research › Kora participants › Assignment record (export) (palette)

- **Purpose:** one reviewer assignment's saved export.
- **Page:** `pages/KoraAssignmentExportPage.tsx`.
- **Back to Kora participants** (`:86-88`).
- Reviewer id, Completed (date or "Not yet") (`:39-44`).
- Results table: Transcript, Status, Opted out (Yes/No), when the export parses (`:9-17`, `:51-70`).
- "No export has been saved yet."; "The export has no readable list of results. The raw export is below." (`:45-50`).
- **Raw export** disclosure with pretty JSON (`:71-78`).
- **Data:** `lib/useKoraBatchesAdmin.ts` → `koraResultsAssignment`.
- **Tests:** `pages/KoraAssignmentExportPage.test.tsx` (results with raw below; unreadable; none saved; assignment gone).
- **Notes:** reachable only from the history's "View its export" links.

## `/kora-participants/preview/:batchId` → Research › Kora participants › Transcript preview, full screen as today (palette)

- **Purpose:** see a random transcript from a batch exactly as reviewers do, saving nothing.
- **Page:** `pages/KoraTranscriptPreviewPage.tsx`, outside the sidebar.
- Sticky yellow bar: "Preview: this is what reviewers see. Nothing you do here is saved.", **Show another transcript** (refetch, disabled while fetching), **Back to Kora participants** (`:44-59`).
- Mounts the real review tool (`kora-review` `mountKoraReview`) with a one-transcript assignment, profile and exit survey off, no-op save (`:16-39`).
- Never cached (`gcTime: 0`, `staleTime: 0`) so each visit is a new random transcript (`lib/useKoraBatchesAdmin.ts:171-176`).
- **Data:** `koraBatchesRandomTranscript`.
- **Shared code:** `kora-review` (mount, parse, style.css).
- **Tests:** `pages/KoraTranscriptPreviewPage.test.tsx` (mounts with a random transcript and says nothing is saved).

---

## `/test-push` Test push → Settings › Developer tools › Send test push (palette)

- **Purpose:** send a push notification to one member's devices to test delivery.
- **Page:** `pages/TestPushNotification.tsx`.
- Recipient `UserSelect` (single; names fall back to "User #id"), loading and failed states (`:28-36`, `:89-97`).
- Message textarea, default "hi" (`:98-109`).
- **Send test push**, disabled until a recipient and non-blank message, "Sending..." (`:81-82`, `:110-118`).
- Errors "Select a user first.", "Message cannot be empty.", or the server's; "Push notification sent."; the response JSON shown below (`:38-79`, `:119-130`).
- **Data:** `userDeviceSendPushNotificationAdmin`; `lib/useUsersAdmin`.
- **Tests:** `pages/TestPushNotification.test.tsx` (user list failure; quiet when refetch fails after load).
- **Notes:** not in the sidebar or the search palette; reachable only by typing the URL. A previous success message stays visible beside a later error.

---

## Summary

This inventory covers 28 routes (`/`, `/invite-feed`, `/invite-links`, `/invites`, `/invites/graph`, `/invite-message-template`, `/share-targets`, `/share-links`, `/custom-links`, `/hosted-docs`, `/organizations`, `/waitlist`, `/waitlist-emails`, `/ambassador-program`, `/outreach-partnerships`, `/action-updates`, `/general-updates`, `/general-updates/:id` including `new`, `/posts/:postId?`, `/image`, `/videos`, `/videos/:videoId`, `/event-log`, `/kora-participants`, its assignment and preview routes, `/test-push`, `/login`) plus the shell (boot, providers, auth, analytics, sidebar, badges, search, member-zone link). It lists about 420 capabilities. The losses a redesign is most likely to cause:

- **Behaviour no rail entry leads to.** `/test-push` isn't in the nav or the search, and `/invites/graph` is only linked from `/invites`.
- **Exact badge semantics.** Outreach counts responses with no notes, and Groups counts every member awaiting a group. Needs reply polls every 30 s (60 s while the socket is connected) and shows "!" when it can't load. Collapsed folders sum their links' badges.
- **Controls hidden in long single pages:**
  - Stats: about 12 independent date ranges and inputs, including the hourly-rate field and the per-chart Absolute and duration filters. The top Start/End range only drives the Daily Stats table.
  - Waitlist: cohorts, tag management, five confirmed bulk actions, request-id idempotent sends, email templates, the metrics panel, and "Use again" from the emails page.
  - Kora: status gating, closing-date edits, the feature-flagged batch delete, the history filter, two notify flows, and two exports.
- **Live behaviours.** Invite feed: socket plus a 10 s poll, with settings in localStorage. Event log: live rows on page 1 only, highlighted for 5 s. Waitlist emails: 3 s polling while a batch sends. The `MmsThreadsLiveProvider` socket is mounted shell-wide.
- **Quiet guards.** Share-target URL-change confirm, campaign groups held by another organization disabled, the post tag-deletion confirm, the hosted-doc ID prefill rules, the content "Save anyway?" check, and the custom-link reserved-path check.
- **Gaps to decide on rather than copy.** A failed invite create on `/invites` is silent. The event-log filter is missing 8 of 17 event types. There's no URL state for any filter. PLACES' "Pending response" tab for outreach and its "Media › Images" library don't exist yet.
