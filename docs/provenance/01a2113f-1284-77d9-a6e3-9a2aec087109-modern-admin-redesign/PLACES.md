# Places: where every current admin route lives

Every one of the 64 routes in `apps/admin/src/routes.ts` at c722280863 has a place below, with none missing and none extra: the route column was compared with the file's route list.

The prototype's `places-md.cjs` generated this map from `places.js`, the config its rail, breadcrumb switcher, palette and placeholder pages are built from. Four corrections were then applied by hand, so the prototype's own config no longer matches it:

- follow-up forms get a Follow-up forms tab on the task record;
- outreach partnerships get no "Pending response" tab, since no such filter exists today;
- Media has no image library: `/image` stays an upload, as today;
- Forms has no entry in the rail. The forms list, each form labelled by the task it belongs to, is reached from the palette and from tasks.

"Rail" is the sidebar. Reachability: the rail is short and fixed: Home, Inbox, Tasks, Members, then the queues Welcome queue, Awaiting a group, Partnership responses, each with its count. Its bottom entry, **All pages and search** (⌘K), opens the palette, which with an empty query lists every one of the 29 places below, grouped by area and browsable with the mouse or arrow keys; typing filters it, and old page names ("scheduled plans", "away members") find their new home. Tabs and views are one click from their place's page. Records (a task, suite, project, form, member and so on) open from their place's list. The Rail column says whether a route's place has its own rail entry or is reached through the palette.

| Today's route | Area | Place | Tab, view or record | Prototype URL | Rail |
|---|---|---|---|---|---|
| `/invite-feed` | Growth | Invites | Invites › Live feed (its Full screen button gives today's chromeless view) | `#/growth/invites` | Palette |
| `/kora-participants/preview/:batchId` | Research | Kora participants | Transcript preview, full screen as today | `#/research` | Palette |
| `/projects` | Tasks | Projects | Projects list | `#/tasks/projects` | Rail: Tasks, then palette or breadcrumb |
| `/projects/:projectId` | Tasks | Projects | Project record (#/project/:id) | `#/tasks/projects` | Rail: Tasks, then palette or breadcrumb |
| `/kora-participants` | Research | Kora participants | Kora participants | `#/research` | Palette |
| `/kora-participants/assignments/:assignmentId` | Research | Kora participants | Assignment record (export) | `#/research` | Palette |
| `/projects/:projectId/action/:actionId` | Tasks | All tasks | Task record, breadcrumb through its project | `#/tasks` | Rail: Tasks |
| `/actions` | Tasks | All tasks | List view | `#/tasks` | Rail: Tasks |
| `/timeline` | Tasks | All tasks | Timeline view | `#/tasks` | Rail: Tasks |
| `/invite-links` | Growth | Invites | Invites › Invite links | `#/growth/invites` | Palette |
| `/invites` | Growth | Invites | Invites › Invites | `#/growth/invites` | Palette |
| `/invites/graph` | Growth | Invites | Invites › Invite graph | `#/growth/invites` | Palette |
| `/friend-graph` | Members | Friend graph | Friend graph | `#/members/friends` | Rail: Members, then palette or breadcrumb |
| `/groups` | Members | Groups | Groups › All groups; members awaiting a group are its second tab | `#/members/groups` | Rail: Members, then palette or breadcrumb |
| `/groups/:id` | Members | Groups | Group record | `#/members/groups` | Rail: Members, then palette or breadcrumb |
| `/clusters` | Members | Clusters | Clusters | `#/members/clusters` | Rail: Members, then palette or breadcrumb |
| `/actions/:actionId` | Tasks | All tasks | Task record (#/task/:id) | `#/tasks` | Rail: Tasks |
| `/actions/:actionId/updates/:updateId` | Tasks | All tasks | Task record › Messages, update open in the side sheet | `#/tasks` | Rail: Tasks |
| `/scheduled` | Activity | Scheduled jobs | Scheduled jobs: upcoming member suspensions and forum task auto-completes | `#/activity/scheduled` | Palette |
| `/suites/:suiteId` | Tasks | Suites | Suite record (#/suite/:id) › Timeline; Tasks, Events, General updates and Partition are its other tabs | `#/tasks/suites` | Rail: Tasks, then palette or breadcrumb |
| `/suites/:suiteId/launch` | Tasks | Suites | Suite record › Launch tab (#/suite/:id?tab=launch), keeps progress across a reload | `#/tasks/suites` | Rail: Tasks, then palette or breadcrumb |
| `/new-suite` | Tasks | Suites | Suites › New suite: a name only, then the empty suite record | `#/tasks/suites` | Rail: Tasks, then palette or breadcrumb |
| `/` | Home | Home | Needs you, then organization stats | `#/home` | Rail: Home |
| `/forms` | Tasks | Forms | Forms list, each form labelled by its task | `#/tasks/forms` | Palette, or from a task |
| `/formulas` | Tasks | Formulas | Formulas list | `#/tasks/formulas` | Rail: Tasks, then palette or breadcrumb |
| `/formulas/:formulaId` | Tasks | Formulas | Formula record (editor) | `#/tasks/formulas` | Rail: Tasks, then palette or breadcrumb |
| `/member-lists` | Members | Member lists | Member lists | `#/members/lists` | Rail: Members, then palette or breadcrumb |
| `/member-lists/:listId` | Members | Member lists | Member list record | `#/members/lists` | Rail: Members, then palette or breadcrumb |
| `/forms/:formId/responses` | Tasks | Forms | Form record › Responses | `#/tasks/forms` | Palette, or from a task |
| `/forms/:formId/snapshots` | Tasks | Forms | Form record › Versions | `#/tasks/forms` | Palette, or from a task |
| `/forms/:formId` | Tasks | Forms | Form record (#/form/:id) › Builder | `#/tasks/forms` | Palette, or from a task |
| `/members/tags` | Members | Tags | Tags | `#/members/tags` | Rail: Members, then palette or breadcrumb |
| `/member/:userId` | Members | People | Member record (side peek, Open for full page) | `#/members` | Rail: Members |
| `/test-push` | Settings | Settings | Settings › Developer tools › Send test push | `#/settings` | Palette |
| `/members` | Members | People | People › All | `#/members` | Rail: Members |
| `/needs-reply` | Inbox | Inbox | Needs reply queue | `#/inbox` | Rail: Inbox |
| `/texts` | Inbox | Inbox | All queue | `#/inbox` | Rail: Inbox |
| `/texts/:threadId` | Inbox | Inbox | Thread open in the conversation pane | `#/inbox` | Rail: Inbox |
| `/image` | Content | Media | Media › Image upload (an upload button; no library of past images, as today) | `#/content/media` | Palette |
| `/videos` | Content | Media | Media › Videos | `#/content/media` | Palette |
| `/videos/:videoId` | Content | Media | Video record | `#/content/media` | Palette |
| `/posts/:postId?` | Content | Forum posts | Forum posts, post open in the side sheet | `#/content/posts` | Palette |
| `/event-log` | Activity | Event log | Event log (streams new events) | `#/activity` | Palette |
| `/welcome-queue` | Members | Welcome queue | Welcome queue | `#/members/welcome` | Rail: Welcome queue |
| `/action-updates` | Content | Task updates | Task updates (each also shows in its task's Messages tab) | `#/content/task-updates` | Palette |
| `/general-updates` | Content | General updates | General updates | `#/content/general-updates` | Palette |
| `/general-updates/:id` | Content | General updates | General update record | `#/content/general-updates` | Palette |
| `/contracts` | Tasks | Contracts | Contracts list | `#/tasks/contracts` | Rail: Tasks, then palette or breadcrumb |
| `/contracts/:id` | Tasks | Contracts | Contract record | `#/tasks/contracts` | Rail: Tasks, then palette or breadcrumb |
| `/ambassador-program` | Growth | Ambassador program | Ambassador program | `#/growth/ambassadors` | Palette |
| `/outreach-partnerships` | Growth | Outreach partnerships | Outreach partnerships | `#/growth/partnerships` | Rail: Partnership responses |
| `/share-targets` | Growth | Links | Links › Share targets | `#/growth/links` | Palette |
| `/share-links` | Growth | Links | Links › Share links | `#/growth/links` | Palette |
| `/custom-links` | Growth | Links | Links › Custom links | `#/growth/links` | Palette |
| `/hosted-docs` | Growth | Links | Links › Hosted docs | `#/growth/links` | Palette |
| `/organizations` | Growth | Organizations | Organizations | `#/growth/organizations` | Palette |
| `/waitlist` | Growth | Waitlist | Waitlist › Entries | `#/growth/waitlist` | Palette |
| `/waitlist-emails` | Growth | Waitlist | Waitlist › Emails | `#/growth/waitlist` | Palette |
| `/invite-message-template` | Growth | Invites | Invites › Message template | `#/growth/invites` | Palette |
| `/priority` | Tasks | All tasks | Priority view | `#/tasks` | Rail: Tasks |
| `/staff-directory` | Members | People | People › Staff | `#/members` | Rail: Members |
| `/member-map` | Members | People | People › Map layout | `#/members` | Rail: Members |
| `/away` | Members | People | People › Away | `#/members` | Rail: Members |
| `/login` | Outside the shell | Login | Login, unchanged (outside the shell) | — | — |

## The rail

- Home
- Inbox · count
- Tasks
- Members
- *Queues:* Welcome queue · count, Awaiting a group · count, Partnership responses · count
- *Footer:* All pages and search (⌘K), account (Settings, Sign out)

## The structure (the palette's browsable list)

- **Home** (`g h`)
  - Home
- **Inbox** (`g i`)
  - Inbox: Needs reply, All
- **Tasks** (`g t`)
  - All tasks (the area's own row): Timeline, List, Priority
  - Suites
  - Projects
  - Forms
  - Formulas
  - Contracts
- **Members** (`g m`)
  - People (the area's own row): All, Staff, Away
  - Welcome queue · badge
  - Groups: All groups, Awaiting assignment · badge
  - Clusters
  - Tags
  - Member lists
  - Friend graph
- **Growth** (`g w`)
  - Invites: Invites, Invite links, Invite graph, Live feed, Message template
  - Waitlist: Entries, Emails
  - Links: Share links, Custom links, Share targets, Hosted docs
  - Organizations
  - Outreach partnerships · badge
  - Ambassador program
- **Content** (`g c`)
  - Task updates
  - General updates
  - Forum posts
  - Media: Image upload, Videos
- **Activity** (`g a`)
  - Event log (the area's own row)
  - Scheduled jobs
- **Research** (`g r`)
  - Kora participants: Participants, Assignments
- **Settings** (`g s`)
  - Settings

Records outside the rail, opened from lists: task (`#/task/:id`, tabs Overview, Form, Variants, Follow-up forms, Messages, Responses, Events, Activity), suite (`#/suite/:id`, tabs Timeline (Overview while it's a draft), Tasks, Events, General updates, Partition behind its flag, and Launch, a page of its own at `?tab=launch`), project (`#/project/:id`, tabs Tasks by suite, Timeline, Task updates), form (`#/form/:id`, tabs Builder, Responses, Versions), member (side peek from People, Inbox, Responses).
