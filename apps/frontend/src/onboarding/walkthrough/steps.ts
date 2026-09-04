import { href } from "react-router";

/** How long the join confirmation holds before the platform takes over. */
export const WELCOME_SECONDS = 3;

export const WALKTHROUGH_PARAM = "walkthrough";

/** Present only on the hop out of the sign-up flow, which plays the shrink. */
export const TOUR_ENTER_PARAM = "tour";

/** Goes on the element a step points at, as `data-walkthrough`. */
export enum WalkthroughAnchor {
  CurrentTask = "current-task",
  ActionUpdates = "action-updates",
  GroupsNav = "groups-nav",
  Group = "group",
  ProfileMenu = "profile-menu",
  AwayRanges = "away-ranges",
  TaskList = "task-list",
}

export type WalkthroughContext = { groupName: string | null };

/** Where the sidebar collapses into a drawer. */
export const DRAWER_QUERY = "(max-width: 767px)";

/** Replaces the step's own anchor and copy wherever `query` matches. */
export type WalkthroughVariant = {
  query: string;
  anchor: WalkthroughAnchor;
  body?: (context: WalkthroughContext) => string;
  /** The anchor only exists once the navigation drawer is open. */
  opensDrawer?: boolean;
};

export type WalkthroughStep = {
  anchor: WalkthroughAnchor;
  path: string;
  title: (context: WalkthroughContext) => string;
  body: (context: WalkthroughContext) => string;
  variant?: WalkthroughVariant;
};

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    anchor: WalkthroughAnchor.CurrentTask,
    path: href("/tasks"),
    title: () => "This is the part that matters",
    body: () =>
      "Your current task. Fifteen minutes, once a week — that is the whole commitment.",
  },
  {
    anchor: WalkthroughAnchor.ActionUpdates,
    path: href("/tasks"),
    title: () => "What came of the last one",
    body: () =>
      "Action updates sit at the top: what the Alliance finished, and what it changed.",
  },
  {
    anchor: WalkthroughAnchor.GroupsNav,
    path: href("/tasks"),
    title: () => "Groups live here",
    body: () =>
      "Groups in the sidebar is how you reach the handful of members you joined alongside. Next takes you there.",
    variant: {
      query: DRAWER_QUERY,
      anchor: WalkthroughAnchor.GroupsNav,
      opensDrawer: true,
      body: () =>
        "The menu button holds your navigation, and Groups is how you reach the members you joined alongside. Next takes you there.",
    },
  },
  {
    anchor: WalkthroughAnchor.Group,
    path: href("/groups"),
    // Null while the member is queued for group assignment.
    title: ({ groupName }) =>
      groupName ? `You’re in ${groupName}` : "Your group appears here",
    body: () =>
      "Together you can discuss actions and keep track of each other’s progress. This is who notices when you show up.",
  },
  {
    anchor: WalkthroughAnchor.ProfileMenu,
    path: href("/groups"),
    title: () => "Your membership is under here",
    body: () =>
      "Open the profile menu in the corner and choose Membership. Next opens it for you.",
  },
  {
    anchor: WalkthroughAnchor.AwayRanges,
    path: href("/membership"),
    title: () => "Weeks you can’t make",
    body: () =>
      "Schedule time away and we plan the week without you. Tell us in advance and nothing is held against you.",
  },
  {
    anchor: WalkthroughAnchor.TaskList,
    path: href("/tasks"),
    title: () => "Start at the top",
    body: () =>
      "Back on your tasks. Set your reminders, say hello to your group, then this week’s action — the one every member is working on at the same time.",
  },
];

export function walkthroughStartHref(): string {
  return `${WALKTHROUGH_STEPS[0].path}?${WALKTHROUGH_PARAM}=0&${TOUR_ENTER_PARAM}=enter`;
}
