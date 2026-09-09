import { href } from "react-router";

/** How long the join confirmation holds before the platform takes over. */
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

export type WalkthroughStep = {
  /** Null on a step that only speaks, which dims the page and spotlights nothing. */
  anchor: WalkthroughAnchor | null;
  path: string;
  title: () => string;
  body: () => string;
};

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    anchor: null,
    path: href("/tasks"),
    title: () => "Welcome!",
    body: () =>
      "You’re now a member of the Alliance. Let’s take a tour of your platform.",
  },
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
    anchor: WalkthroughAnchor.ProfileMenu,
    path: href("/tasks"),
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
      "Back on your tasks. Set your reminders, then this week’s action, the one every member is working on at the same time.",
  },
];

export function walkthroughStartHref(): string {
  return `${WALKTHROUGH_STEPS[0].path}?${WALKTHROUGH_PARAM}=0&${TOUR_ENTER_PARAM}=enter`;
}
