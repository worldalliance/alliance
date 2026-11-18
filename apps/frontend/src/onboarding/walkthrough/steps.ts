import { href } from "react-router";

export const WALKTHROUGH_PARAM = "walkthrough";

/** Present only on the hop out of sign-up, which plays the white intro. */
export const TOUR_INTRO_PARAM = "intro";

/** Goes on the open task on the tasks page, as `data-walkthrough`. */
export const FIRST_TASK_ANCHOR = "current-task";

export const WALKTHROUGH_PATH = href("/tasks");

export function walkthroughStartHref(): string {
  return `${WALKTHROUGH_PATH}?${WALKTHROUGH_PARAM}=1&${TOUR_INTRO_PARAM}=1`;
}
