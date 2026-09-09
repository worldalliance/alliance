import { WalkthroughAnchor } from "./walkthrough";

export const WALKTHROUGH_PARAM = "walkthrough";

export type WalkthroughStep = {
  /** Omitted by a step that introduces the tour rather than pointing into it. */
  anchor?: WalkthroughAnchor;
  path: "/" | "/groups" | "/membership";
  title: () => string;
  body: () => string;
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
      "You’re now a member of the Alliance. Let’s take a tour of your platform.",
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
    anchor: WalkthroughAnchor.MembershipLink,
    path: "/",
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
