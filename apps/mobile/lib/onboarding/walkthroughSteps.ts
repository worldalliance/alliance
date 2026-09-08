import { WalkthroughAnchor } from "./walkthrough";

export const WALKTHROUGH_PARAM = "walkthrough";

export type WalkthroughContext = { groupName: string | null };

export type WalkthroughStep = {
  /** Omitted by a step that introduces the tour rather than pointing into it. */
  anchor?: WalkthroughAnchor;
  path: "/" | "/groups" | "/membership";
  title: (context: WalkthroughContext) => string;
  body: (context: WalkthroughContext) => string;
  /**
   * Sits at the foot of the screen rather than above the tab bar. For a step
   * whose anchor is tall or behind the drawer, the room matters more than
   * keeping the navigation clear.
   */
  dockBottom?: boolean;
};

/**
 * The web flow's steps, minus its own "download the app" screen and the action
 * updates the mobile home does not show. Where the web points at a sidebar the
 * app points at its tab bar or drawer, since that is where the same
 * destination lives here.
 */
export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    path: "/",
    title: () => "Welcome!",
    body: () =>
      "This is your Alliance platform where we coordinate actions every week. Let’s take a tour.",
    dockBottom: true,
  },
  {
    anchor: WalkthroughAnchor.CurrentTask,
    path: "/",
    title: () => "This is the part that matters",
    body: () =>
      "Your current task. Fifteen minutes, once a week — that is the whole commitment.",
  },
  {
    anchor: WalkthroughAnchor.GroupsTab,
    path: "/",
    title: () => "Groups live here",
    body: () =>
      "Groups in the tab bar is how you reach the handful of members you joined alongside. Next takes you there.",
  },
  {
    anchor: WalkthroughAnchor.Group,
    path: "/groups",
    title: ({ groupName }) =>
      groupName ? `You’re in ${groupName}` : "Your group appears here",
    body: ({ groupName }) =>
      groupName
        ? "Together you can discuss actions and keep track of each other’s progress. This is who notices when you show up."
        : "You will be placed in a group of members who joined alongside you. This is who notices when you show up.",
  },
  {
    anchor: WalkthroughAnchor.MembershipLink,
    path: "/groups",
    dockBottom: true,
    title: () => "Your membership is under here",
    body: () =>
      "The menu button holds the rest of your navigation. Membership is where your commitment lives — next opens it for you.",
  },
  {
    anchor: WalkthroughAnchor.AwayRanges,
    path: "/membership",
    dockBottom: true,
    title: () => "Weeks you can’t make",
    body: () =>
      "Schedule time away and we plan the week without you. Tell us in advance and nothing is held against you.",
  },
  {
    anchor: WalkthroughAnchor.TaskList,
    path: "/",
    title: () => "Start at the top",
    body: () =>
      "Back on your tasks. Set your reminders, say hello to your group, then this week’s action — the one every member is working on at the same time.",
  },
];

/** Distinguishes one entry from the next, since the index alone repeats. */
export const WALKTHROUGH_ENTRY_PARAM = "tour";

export function walkthroughStart() {
  return {
    pathname: WALKTHROUGH_STEPS[0].path,
    params: {
      [WALKTHROUGH_PARAM]: "0",
      [WALKTHROUGH_ENTRY_PARAM]: String(Date.now()),
    },
  } as const;
}
