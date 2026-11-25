/* alliance/max-lines 750 -- data: the page map, one entry per area, place, tab and record */
/**
 * The admin's page map: every area, place, tab and record. The sidebar,
 * palette, breadcrumbs and titles all read it, so a place is added or moved
 * here and nowhere else. `legacyRoutes.ts` says where each old URL went.
 */

export enum AreaId {
  Home = "home",
  Inbox = "inbox",
  Tasks = "tasks",
  Members = "members",
  Growth = "growth",
  Content = "content",
  Activity = "activity",
  Research = "research",
  Settings = "settings",
}

export enum PlaceId {
  Home = "home",
  Inbox = "inbox",
  AllTasks = "all-tasks",
  Suites = "suites",
  Projects = "projects",
  Forms = "forms",
  Formulas = "formulas",
  Contracts = "contracts",
  People = "people",
  WelcomeQueue = "welcome-queue",
  Groups = "groups",
  Clusters = "clusters",
  Tags = "tags",
  MemberLists = "member-lists",
  FriendGraph = "friend-graph",
  Invites = "invites",
  Waitlist = "waitlist",
  Links = "links",
  Organizations = "organizations",
  OutreachPartnerships = "outreach-partnerships",
  AmbassadorProgram = "ambassador-program",
  TaskUpdates = "task-updates",
  GeneralUpdates = "general-updates",
  ForumPosts = "forum-posts",
  Media = "media",
  EventLog = "event-log",
  ScheduledJobs = "scheduled-jobs",
  KoraParticipants = "kora-participants",
  Settings = "settings",
}

export enum RecordId {
  Thread = "thread",
  Task = "task",
  TaskUpdate = "task-update",
  ProjectTask = "project-task",
  Suite = "suite",
  NewSuite = "new-suite",
  Project = "project",
  Form = "form",
  Formula = "formula",
  Contract = "contract",
  Member = "member",
  Group = "group",
  MemberList = "member-list",
  InviteFeedFullScreen = "invite-feed-full-screen",
  GeneralUpdate = "general-update",
  Video = "video",
  KoraAssignment = "kora-assignment",
  KoraTranscriptPreview = "kora-transcript-preview",
}

/** The queues whose size the shell shows beside their entry. */
export enum CountId {
  NeedsReply = "needs-reply",
  WelcomeQueue = "welcome-queue",
  AwaitingGroup = "awaiting-group",
  PartnershipResponses = "partnership-responses",
}

/** Each queue: what Home says beside its count, the button to it, and where that goes. */
export const QUEUES: Record<
  CountId,
  { label: string; open: string; place: PlaceId; tab?: string }
> = {
  [CountId.NeedsReply]: {
    label: "Texts need a reply",
    open: "Open inbox",
    place: PlaceId.Inbox,
  },
  [CountId.WelcomeQueue]: {
    label: "New members to welcome",
    open: "Open welcome queue",
    place: PlaceId.WelcomeQueue,
  },
  [CountId.AwaitingGroup]: {
    label: "Members awaiting a group",
    open: "Open group assignment",
    place: PlaceId.Groups,
    tab: "awaiting",
  },
  [CountId.PartnershipResponses]: {
    label: "Partnership responses to review",
    open: "Open partnerships",
    place: PlaceId.OutreachPartnerships,
  },
};

export type PlaceTab = {
  /** The `?tab=` or `?view=` value; the first of a list is the bare URL. */
  id: string;
  label: string;
  /** What staff called this page before the redesign. */
  oldNames?: readonly string[];
  count?: CountId;
};

export type Place = {
  id: PlaceId;
  area: AreaId;
  label: string;
  path: string;
  /** `?tab=`: parts of the place, each with its own content. */
  tabs?: readonly PlaceTab[];
  /** `?view=`: other layouts of the same items. */
  views?: readonly PlaceTab[];
  oldNames?: readonly string[];
  /** Other words search finds it by, such as an old folder that held it. */
  keywords?: readonly string[];
  count?: CountId;
};

export type Area = {
  id: AreaId;
  label: string;
  /** `g` then this letter goes to the area's first place. */
  key: string;
  places: readonly Place[];
};

export const AREAS: readonly Area[] = [
  {
    id: AreaId.Home,
    label: "Home",
    key: "h",
    places: [
      {
        id: PlaceId.Home,
        area: AreaId.Home,
        label: "Home",
        path: "/",
        oldNames: ["Stats"],
      },
    ],
  },
  {
    id: AreaId.Inbox,
    label: "Inbox",
    key: "i",
    places: [
      {
        id: PlaceId.Inbox,
        area: AreaId.Inbox,
        label: "Inbox",
        path: "/inbox",
        count: CountId.NeedsReply,
        tabs: [
          { id: "needs-reply", label: "Needs reply" },
          { id: "all", label: "All", oldNames: ["Texts"] },
        ],
      },
    ],
  },
  {
    id: AreaId.Tasks,
    label: "Tasks",
    key: "t",
    places: [
      {
        id: PlaceId.AllTasks,
        area: AreaId.Tasks,
        label: "All tasks",
        path: "/tasks",
        keywords: ["Action planning"],
        views: [
          { id: "timeline", label: "Timeline" },
          { id: "list", label: "List", oldNames: ["Actions"] },
          { id: "priority", label: "Priority" },
        ],
      },
      {
        id: PlaceId.Suites,
        area: AreaId.Tasks,
        label: "Suites",
        path: "/tasks/suites",
        oldNames: ["Action suites"],
      },
      {
        id: PlaceId.Projects,
        area: AreaId.Tasks,
        label: "Projects",
        path: "/tasks/projects",
      },
      {
        id: PlaceId.Forms,
        area: AreaId.Tasks,
        label: "Forms",
        path: "/tasks/forms",
      },
      {
        id: PlaceId.Formulas,
        area: AreaId.Tasks,
        label: "Formulas",
        path: "/tasks/formulas",
      },
      {
        id: PlaceId.Contracts,
        area: AreaId.Tasks,
        label: "Contracts",
        path: "/tasks/contracts",
      },
    ],
  },
  {
    id: AreaId.Members,
    label: "Members",
    key: "m",
    places: [
      {
        id: PlaceId.People,
        area: AreaId.Members,
        label: "People",
        path: "/members",
        oldNames: ["Members"],
        keywords: ["Community"],
        tabs: [
          { id: "all", label: "All" },
          { id: "staff", label: "Staff", oldNames: ["Staff directory"] },
          { id: "away", label: "Away", oldNames: ["Away members"] },
        ],
        views: [
          { id: "table", label: "Table" },
          { id: "map", label: "Map", oldNames: ["Member map"] },
        ],
      },
      {
        id: PlaceId.WelcomeQueue,
        area: AreaId.Members,
        label: "Welcome queue",
        path: "/members/welcome",
        count: CountId.WelcomeQueue,
      },
      {
        id: PlaceId.Groups,
        area: AreaId.Members,
        label: "Groups",
        path: "/members/groups",
        count: CountId.AwaitingGroup,
        tabs: [
          { id: "all", label: "All groups" },
          {
            id: "awaiting",
            label: "Awaiting assignment",
            oldNames: ["Group assignment", "Awaiting a group"],
            count: CountId.AwaitingGroup,
          },
        ],
      },
      {
        id: PlaceId.Clusters,
        area: AreaId.Members,
        label: "Clusters",
        path: "/members/clusters",
      },
      {
        id: PlaceId.Tags,
        area: AreaId.Members,
        label: "Tags",
        path: "/members/tags",
        oldNames: ["Tag management"],
      },
      {
        id: PlaceId.MemberLists,
        area: AreaId.Members,
        label: "Member lists",
        path: "/members/lists",
      },
      {
        id: PlaceId.FriendGraph,
        area: AreaId.Members,
        label: "Friend graph",
        path: "/members/friends",
      },
    ],
  },
  {
    id: AreaId.Growth,
    label: "Growth",
    key: "w",
    places: [
      {
        id: PlaceId.Invites,
        area: AreaId.Growth,
        label: "Invites",
        path: "/growth/invites",
        oldNames: ["User invites"],
        tabs: [
          { id: "invites", label: "Invites", oldNames: ["User invites"] },
          { id: "links", label: "Invite links" },
          { id: "graph", label: "Invite graph" },
          { id: "feed", label: "Live feed", oldNames: ["Live invite feed"] },
          {
            id: "template",
            label: "Message template",
            oldNames: ["Invitation message"],
          },
        ],
      },
      {
        id: PlaceId.Waitlist,
        area: AreaId.Growth,
        label: "Waitlist",
        path: "/growth/waitlist",
        tabs: [
          { id: "entries", label: "Entries", oldNames: ["Waitlist entries"] },
          { id: "emails", label: "Emails", oldNames: ["Waitlist emails"] },
        ],
      },
      {
        id: PlaceId.Links,
        area: AreaId.Growth,
        label: "Links",
        path: "/growth/links",
        tabs: [
          { id: "share-links", label: "Share links" },
          { id: "custom-links", label: "Custom links" },
          { id: "share-targets", label: "Share targets" },
          { id: "hosted-docs", label: "Hosted docs" },
        ],
      },
      {
        id: PlaceId.Organizations,
        area: AreaId.Growth,
        label: "Organizations",
        path: "/growth/organizations",
      },
      {
        id: PlaceId.OutreachPartnerships,
        area: AreaId.Growth,
        label: "Outreach partnerships",
        path: "/growth/partnerships",
        oldNames: ["Partnership responses"],
        count: CountId.PartnershipResponses,
      },
      {
        id: PlaceId.AmbassadorProgram,
        area: AreaId.Growth,
        label: "Ambassador program",
        path: "/growth/ambassadors",
      },
    ],
  },
  {
    id: AreaId.Content,
    label: "Content",
    key: "c",
    places: [
      {
        id: PlaceId.TaskUpdates,
        area: AreaId.Content,
        label: "Task updates",
        path: "/content/task-updates",
        oldNames: ["Action updates"],
      },
      {
        id: PlaceId.GeneralUpdates,
        area: AreaId.Content,
        label: "General updates",
        path: "/content/general-updates",
      },
      {
        id: PlaceId.ForumPosts,
        area: AreaId.Content,
        label: "Forum posts",
        path: "/content/posts",
      },
      {
        id: PlaceId.Media,
        area: AreaId.Content,
        label: "Media",
        path: "/content/media",
        tabs: [
          { id: "images", label: "Image upload" },
          { id: "videos", label: "Videos" },
        ],
      },
    ],
  },
  {
    id: AreaId.Activity,
    label: "Activity",
    key: "a",
    places: [
      {
        id: PlaceId.EventLog,
        area: AreaId.Activity,
        label: "Event log",
        path: "/activity",
      },
      {
        id: PlaceId.ScheduledJobs,
        area: AreaId.Activity,
        label: "Scheduled jobs",
        path: "/activity/scheduled",
        oldNames: ["Scheduled plans", "Suspensions", "Forum auto-complete"],
      },
    ],
  },
  {
    id: AreaId.Research,
    label: "Research",
    key: "r",
    places: [
      {
        id: PlaceId.KoraParticipants,
        area: AreaId.Research,
        label: "Kora participants",
        path: "/research",
        tabs: [
          { id: "participants", label: "Participants" },
          {
            id: "assignments",
            label: "Assignments",
            oldNames: ["Kora transcripts"],
          },
        ],
      },
    ],
  },
  {
    id: AreaId.Settings,
    label: "Settings",
    key: "s",
    places: [
      {
        id: PlaceId.Settings,
        area: AreaId.Settings,
        label: "Settings",
        path: "/settings",
        oldNames: ["Test push notification"],
        keywords: ["Developer tools"],
      },
    ],
  },
];

export const PLACES: readonly Place[] = AREAS.flatMap((area) => area.places);

const placesById = new Map(PLACES.map((place) => [place.id, place]));
const areasById = new Map(AREAS.map((area) => [area.id, area]));

export const placeById = (id: PlaceId): Place => {
  const place = placesById.get(id);
  if (!place) throw new Error(`unknown place: ${id}`);
  return place;
};

export const areaById = (id: AreaId): Area => {
  const area = areasById.get(id);
  if (!area) throw new Error(`unknown area: ${id}`);
  return area;
};

export type AdminRecord = {
  id: RecordId;
  place: PlaceId;
  /** What one of these is called, for a breadcrumb or title with no name yet. */
  label: string;
  path: string;
  /** The tab of its place that lists it, when that isn't the first: its breadcrumb goes back there. */
  tab?: string;
  tabs?: readonly PlaceTab[];
  /** Renders without the sidebar, as it did before the redesign. */
  fullScreen?: boolean;
};

export const RECORDS: readonly AdminRecord[] = [
  {
    id: RecordId.Thread,
    place: PlaceId.Inbox,
    label: "Thread",
    path: "/inbox/:threadId",
  },
  {
    id: RecordId.Task,
    place: PlaceId.AllTasks,
    label: "Task",
    path: "/tasks/:actionId",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "form", label: "Form" },
      { id: "variants", label: "Variants" },
      { id: "follow-up-forms", label: "Follow-up forms" },
      { id: "messages", label: "Messages" },
      { id: "responses", label: "Responses" },
      { id: "events", label: "Events" },
      { id: "activity", label: "Activity" },
    ],
  },
  {
    id: RecordId.TaskUpdate,
    place: PlaceId.AllTasks,
    label: "Task update",
    path: "/tasks/:actionId/updates/:updateId",
  },
  {
    id: RecordId.ProjectTask,
    place: PlaceId.Projects,
    label: "Task",
    path: "/tasks/projects/:projectId/tasks/:actionId",
  },
  {
    id: RecordId.NewSuite,
    place: PlaceId.Suites,
    label: "New suite",
    path: "/tasks/suites/new",
  },
  {
    id: RecordId.Suite,
    place: PlaceId.Suites,
    label: "Suite",
    path: "/tasks/suites/:suiteId",
    tabs: [
      { id: "timeline", label: "Timeline" },
      { id: "tasks", label: "Tasks" },
      { id: "events", label: "Events" },
      { id: "general-updates", label: "General updates" },
      { id: "partition", label: "Partition" },
      { id: "launch", label: "Launch" },
    ],
  },
  {
    id: RecordId.Project,
    place: PlaceId.Projects,
    label: "Project",
    path: "/tasks/projects/:projectId",
    tabs: [
      { id: "tasks", label: "Tasks by suite" },
      { id: "timeline", label: "Timeline" },
      { id: "task-updates", label: "Task updates" },
    ],
  },
  {
    id: RecordId.Form,
    place: PlaceId.Forms,
    label: "Form",
    path: "/tasks/forms/:formId",
    tabs: [
      { id: "builder", label: "Builder" },
      { id: "responses", label: "Responses" },
      { id: "versions", label: "Versions" },
    ],
  },
  {
    id: RecordId.Formula,
    place: PlaceId.Formulas,
    label: "Formula",
    path: "/tasks/formulas/:formulaId",
  },
  {
    id: RecordId.Contract,
    place: PlaceId.Contracts,
    label: "Contract",
    path: "/tasks/contracts/:id",
  },
  {
    id: RecordId.Member,
    place: PlaceId.People,
    label: "Member",
    path: "/members/:userId",
  },
  {
    id: RecordId.Group,
    place: PlaceId.Groups,
    label: "Group",
    path: "/members/groups/:id",
    tabs: [
      { id: "members", label: "Members" },
      { id: "progress", label: "Progress" },
      { id: "settings", label: "Settings" },
    ],
  },
  {
    id: RecordId.MemberList,
    place: PlaceId.MemberLists,
    label: "Member list",
    path: "/members/lists/:listId",
  },
  {
    id: RecordId.InviteFeedFullScreen,
    place: PlaceId.Invites,
    label: "Live feed",
    path: "/growth/invites/feed",
    fullScreen: true,
  },
  {
    id: RecordId.GeneralUpdate,
    place: PlaceId.GeneralUpdates,
    label: "General update",
    path: "/content/general-updates/:id",
    tabs: [
      { id: "details", label: "Details" },
      { id: "content", label: "Content" },
    ],
  },
  {
    id: RecordId.Video,
    place: PlaceId.Media,
    label: "Video",
    path: "/content/media/videos/:videoId",
    tab: "videos",
  },
  {
    id: RecordId.KoraAssignment,
    place: PlaceId.KoraParticipants,
    label: "Assignment",
    path: "/research/assignments/:assignmentId",
  },
  {
    id: RecordId.KoraTranscriptPreview,
    place: PlaceId.KoraParticipants,
    label: "Transcript preview",
    path: "/research/preview/:batchId",
    fullScreen: true,
  },
];

const recordsById = new Map(RECORDS.map((record) => [record.id, record]));

export const recordById = (id: RecordId): AdminRecord => {
  const record = recordsById.get(id);
  if (!record) throw new Error(`unknown record: ${id}`);
  return record;
};

/** Forum posts keep the post in the place's own path, open in its side sheet. */
export const FORUM_POST_PATH = "/content/posts/:postId?";

export enum TabParam {
  Tab = "tab",
  View = "view",
}

/** The first tab or view is the bare URL, so a default never shows in it. */
export const tabHref = (
  place: Place,
  selected: { tab?: string; view?: string },
): string => {
  const search = new URLSearchParams();
  if (selected.tab && selected.tab !== place.tabs?.[0]?.id) {
    search.set(TabParam.Tab, selected.tab);
  }
  if (selected.view && selected.view !== place.views?.[0]?.id) {
    search.set(TabParam.View, selected.view);
  }
  const query = search.toString();
  return query ? `${place.path}?${query}` : place.path;
};

/** An unknown or missing value falls back to the first, as the bare URL does. */
export const selectedTab = (
  tabs: readonly PlaceTab[],
  value: string | null,
): PlaceTab => tabs.find((tab) => tab.id === value) ?? tabs[0];

export type Crumb = { label: string; to: string };

/**
 * The breadcrumb down to a place: its area, then the place unless it is the
 * area's own first page. A record page appends its own crumb.
 */
export const placeTrail = (id: PlaceId): Crumb[] => {
  const place = placeById(id);
  const area = areaById(place.area);
  const head = area.places[0];
  const areaCrumb = { label: area.label, to: head.path };
  return head.id === place.id
    ? [areaCrumb]
    : [areaCrumb, { label: place.label, to: place.path }];
};

/** `<title>` text: the record's or place's name, then the app. */
export const documentTitle = (name: string): string => `${name} - Admin`;

export const placeTitle = (id: PlaceId): string =>
  documentTitle(placeById(id).label);

export type RailEntry = {
  label: string;
  place: PlaceId;
  tab?: string;
  count?: CountId;
};

export const RAIL: readonly RailEntry[] = [
  { label: "Home", place: PlaceId.Home },
  { label: "Inbox", place: PlaceId.Inbox, count: CountId.NeedsReply },
  { label: "Tasks", place: PlaceId.AllTasks },
  { label: "Members", place: PlaceId.People },
];

const railQueue = (label: string, count: CountId): RailEntry => ({
  label,
  place: QUEUES[count].place,
  tab: QUEUES[count].tab,
  count,
});

export const RAIL_QUEUES: readonly RailEntry[] = [
  railQueue("Welcome queue", CountId.WelcomeQueue),
  railQueue("Awaiting a group", CountId.AwaitingGroup),
  railQueue("Partnership responses", CountId.PartnershipResponses),
];

export const railHref = (entry: Pick<RailEntry, "place" | "tab">): string =>
  tabHref(placeById(entry.place), { tab: entry.tab });

export const queueHref = (id: CountId): string => railHref(QUEUES[id]);

/**
 * The rail entry a location belongs to: a queue when the location is that
 * queue, otherwise the main entry whose area holds it. Places reached only
 * through the palette light nothing.
 */
export const activeRailEntry = (location: {
  pathname: string;
  search: string;
}): RailEntry | null => {
  const tab = new URLSearchParams(location.search).get(TabParam.Tab);
  const under = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname === path || location.pathname.startsWith(`${path}/`);
  const queue = RAIL_QUEUES.find((entry) => {
    const place = placeById(entry.place);
    return under(place.path) && (!entry.tab || entry.tab === tab);
  });
  if (queue) return queue;
  return (
    RAIL.find((entry) => under(placeById(entry.place).path)) ??
    RAIL.find((entry) => {
      const area = areaById(placeById(entry.place).area);
      return area.places.some((place) => under(place.path));
    }) ??
    null
  );
};
