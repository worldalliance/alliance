import { ActionActivityType } from "@alliance/common/actionActivity";
import { CachedFilter } from "../utils/cached-filter";
import { findLeast } from "../utils/filter";
import type { ActionActivity } from "./entities/action-activity.entity";

/**
 * The viewer's collapsed relation to an action, as exposed on the legacy
 * `ActionDto.userRelation` wire field. Lives here (not in `action.dto.ts`)
 * so status modules can import it without a dto↔module import cycle;
 * `action.dto.ts` re-exports it.
 *
 * NOTE: `Dismissed` is not a real relation — dismissal is a view-only
 * "mark as seen" overlay (see `ActionActivityType.USER_DISMISSED`). The
 * `viewer` object models it as a separate boolean; this enum keeps it only
 * for wire compatibility.
 */
export enum UserActionRelation {
  Completed = "completed",
  None = "none",
  Declined = "declined",
  Dismissed = "dismissed",
}

/**
 * A "terminal" activity determines a user's status on an action: an explicit
 * completion or withdrawal. Dismissals (which only hide the action from the home
 * page) and follow-up form submissions never do.
 */
const IS_TERMINAL_ACTIVITY_TYPE = {
  [ActionActivityType.USER_COMPLETED]: true,
  [ActionActivityType.USER_WONT_COMPLETE]: true,

  [ActionActivityType.USER_DISMISSED]: false,
  [ActionActivityType.USER_SUBMITTED_FOLLOW_UP_FORM]: false,
} as const satisfies Record<ActionActivityType, boolean>;

/**
 * The activity types that determine a user's status, derived from
 * {@link IS_TERMINAL_ACTIVITY_TYPE} so the two can't drift: adding a new
 * terminal type to the map above widens this union, which in turn makes the
 * status-mapping `switch`es in {@link resolveUserActionRelation} and the
 * admin/leader pill pass fail to compile until they handle it.
 */
export type TerminalActivityType = {
  [K in ActionActivityType]: (typeof IS_TERMINAL_ACTIVITY_TYPE)[K] extends true
    ? K
    : never;
}[ActionActivityType];

function isTerminalActivity<T extends Pick<ActionActivity, "type">>(
  activity: T,
): activity is T & { type: TerminalActivityType } {
  return IS_TERMINAL_ACTIVITY_TYPE[activity.type];
}

/**
 * A user's latest terminal activity on one action — their most recent completion
 * or withdrawal — or `null` if neither exists.
 *
 * Latest wins chronologically, so a completion after a withdrawal (or vice
 * versa) reflects most recent intent. Single source of truth for both the
 * self-view relation ({@link resolveUserActionRelation}) and the admin/leader
 * pill status.
 *
 * Assumes `activities` are pre-filtered to one user + one action.
 */
export function findLatestTerminalActivity<
  T extends Pick<ActionActivity, "type" | "createdAt">,
>(activities: T[]): (T & { type: TerminalActivityType }) | null {
  return findLeast(
    activities,
    // most-recent-first, so "least" terminal is most recent.
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    isTerminalActivity,
  );
}

/**
 * Resolves a user's self-view relation to one action, selecting that user's
 * activities from a {@link CachedFilter}.
 *
 * Completion and withdrawal are terminal; most recent wins (see
 * {@link findLatestTerminalActivity}), so completing a previously dismissed —
 * or, in future, previously declined — action reads as `Completed`. A bare
 * dismissal (no terminal activity) reads as `Dismissed`, which the home page
 * uses to hide the action; it never masks a completion.
 */
export function resolveUserActionRelation(params: {
  activities: CachedFilter<
    Pick<ActionActivity, "type" | "createdAt" | "userId" | "actionId">
  >;
  userId: number;
  actionId: number;
}): UserActionRelation {
  const { activities, userId, actionId } = params;
  const relevant = activities.filtered({ userId, actionId });
  const terminal = findLatestTerminalActivity(relevant);
  if (terminal) {
    switch (terminal.type) {
      case ActionActivityType.USER_COMPLETED:
        return UserActionRelation.Completed;
      case ActionActivityType.USER_WONT_COMPLETE:
        return UserActionRelation.Declined;
      default:
        throw new Error(
          `unknown terminal activity type: ${terminal.type satisfies never}`,
        );
    }
  }
  if (relevant.some((a) => a.type === ActionActivityType.USER_DISMISSED)) {
    return UserActionRelation.Dismissed;
  }
  return UserActionRelation.None;
}
