import { href } from "react-router";
import { MOCK_PARAM } from "../useMockTasks";

export const WALKTHROUGH_PARAM = "walkthrough";

/** Present only on the hop out of sign-up, which plays the white intro. */
export const TOUR_INTRO_PARAM = "intro";

/** Goes on the element a step points at, as `data-walkthrough`. */
export enum WalkthroughAnchor {
  CurrentTask = "current-task",
  ActionUpdates = "action-updates",
  GroupsNav = "groups-nav",
  Group = "group",
  ProfileMenu = "profile-menu",
  Contract = "contract",
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
      "You’re now a member of the Alliance. Let’s take a tour of the platform.",
  },
  {
    anchor: WalkthroughAnchor.CurrentTask,
    path: href("/tasks"),
    title: () => "The most important part",
    body: () =>
      "Here, you'll see any tasks you've been assigned. Tasks will take no more than 15 minutes per week.",
  },
  {
    anchor: WalkthroughAnchor.ActionUpdates,
    path: href("/tasks"),
    title: () => "Updates on our projects",
    body: () =>
      "Here, we share updates about our projects, including the impact we've made together.",
  },
  {
    anchor: WalkthroughAnchor.ProfileMenu,
    path: href("/tasks"),
    title: () => "Manage your membership",
    body: () => "Choose Membership from the profile menu.",
  },
  {
    anchor: WalkthroughAnchor.Contract,
    path: href("/membership"),
    title: () => "Your agreement",
    body: () =>
      "This is what you signed to become a member. You can end your agreement here, and we’ll stop assigning you tasks.",
  },
  {
    anchor: WalkthroughAnchor.AwayRanges,
    path: href("/membership"),
    title: () => "Weeks you can’t make",
    body: () =>
      "Tell us in advance if you won't be able to complete tasks for a while, so that we can plan around your absence.",
  },
  {
    anchor: WalkthroughAnchor.TaskList,
    path: href("/tasks"),
    title: () => "Start at the top",
    body: () =>
      "Back to your tasks page, which now includes some onboarding tasks to get you started.",
  },
];

export function walkthroughStartHref(): string {
  return `${WALKTHROUGH_STEPS[0].path}?${WALKTHROUGH_PARAM}=0&${TOUR_INTRO_PARAM}=1`;
}

export function walkthroughStepHref(at: number, mocked = false): string {
  const query = new URLSearchParams({ [WALKTHROUGH_PARAM]: String(at) });
  if (mocked) query.set(MOCK_PARAM, "1");
  return `${WALKTHROUGH_STEPS[at].path}?${query}`;
}
