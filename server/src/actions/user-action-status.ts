import {
  ActionActivityType,
  WithdrawalOption,
  withdrawalOptionFromFlags,
} from "@alliance/common/actionActivity";
import type { User } from "src/user/entities/user.entity";
import {
  computeContractSignedAfterOnboardingStart,
  computeIsAssignedToAction,
  computeIsAwayDuringWindow,
  computeMemberActionAwayStatus,
  hasMemberActionStarted,
  TaskAwayStatus,
} from "src/utils/action-user";
import { UserActionRelationPillStatus } from "../user/dto/user-action-relations.dto";
import { findLatestTerminalActivity } from "./action-activity-status";
import type { ActionActivity } from "./entities/action-activity.entity";
import { ActionEvent, ActionStatus } from "./entities/action-event.entity";
import type { Action } from "./entities/action.entity";
import { resolveUserActionPillStatus } from "./user-action-pill-status";
import { actionStatusAt } from "./utils/action-event";

/**
 * The viewer's full status on one action — the single composition point for
 * the four independent user↔action axes:
 *
 * 1. **assignment** (`assigned`): cohort membership + contract rule
 * 2. **completion permission** (`canComplete`)
 * 3. **activity relation** (`relation` / `withdrawal`): latest terminal activity
 * 4. **away** (`away`): now-relative away phase
 *
 * plus the overlays/derivations every view needs (`dismissed`, `deadline*`,
 * `display`). Exposed on the wire as `ActionDto.viewer`. The legacy flat
 * fields (`shouldParticipate`, `canParticipate`, `userRelation`, `awayStatus`)
 * are aliases with pre-viewer semantics; they go away once all apps read
 * `viewer`.
 */
export type UserActionStatus = {
  /**
   * Is the viewer assigned this action? Cohort membership plus the contract
   * rule (onboarding → first contract signed at/after phase start; otherwise →
   * active contract across the member-action window).
   *
   * Unlike the legacy `shouldParticipate` field, dismissal does NOT revoke
   * assignment — it's a view-only overlay (see `dismissed`).
   */
  assigned: boolean;
  /**
   * May the viewer complete this action? Deliberately looser than `assigned`:
   * members without an active contract may still complete regular actions —
   * they're just not expected to (no home-page listing, no reminders, no
   * suspension accounting). Decided 2026-07. See
   * {@link computeCanCompleteAction} for the exact rule.
   */
  canComplete: boolean;
  /** Latest terminal activity: completed, withdrawn, or none. */
  relation: ViewerActionRelation;
  /** Why the viewer withdrew; only set when `relation` is `Withdrawn`. */
  withdrawal: UserActionWithdrawal | null;
  /**
   * View-only "mark as seen" overlay: the viewer hid this action's card from
   * their home page (which also mutes their reminders). NOT a relation — a
   * dismissed action is still assigned and completable. See the
   * `ActionActivityType.USER_DISMISSED` doc in `common/`.
   */
  dismissed: boolean;
  /** Now-relative away phase over the member-action window. */
  away: TaskAwayStatus;
  /**
   * Has a member-action phase opened (some member-action event is in the
   * past)? Distinguishes "not started yet" from "mid-window" — `deadline*`
   * alone can't. The client-side gate for showing/enabling the task form.
   */
  memberActionStarted: boolean;
  /** End of the member-action window, if one exists. */
  deadlineAt: Date | null;
  deadlinePassed: boolean;
  /**
   * The single-enum collapse of the above for display (same value the
   * leader/admin member tables show as pills).
   */
  display: UserActionRelationPillStatus;
  /**
   * Is the viewer someone {@link canSeeStaffPreview} lets in, seeing this
   * action before it opens? Every other field still describes the action as it
   * really is, unstarted and not completable.
   */
  preview: boolean;
  /**
   * Is the action's discussion shut to the viewer, so no comment and no like?
   * A preview shuts it only where members cannot read the action at all. On
   * one they can, it leaves the thread as it found it.
   */
  discussionClosed: boolean;
};

export enum ViewerActionRelation {
  Completed = "completed",
  Withdrawn = "withdrawn",
  None = "none",
}

export type UserActionWithdrawal = {
  reason: WithdrawalOption;
  /** Free-text reason; required for `moral`/`other`, absent for `out_of_time`. */
  note: string | null;
};

/** The line `userCanSeeAction` turns members away on, as of `at`. */
export function actionHiddenFromMembers(
  action: Pick<Action, "archived" | "events">,
  at: Date,
): boolean {
  return (
    actionStatusAt(action.events, at) === ActionStatus.Draft || action.archived
  );
}

const launchHasHappenedIn = {
  [ActionStatus.Draft]: false,
  [ActionStatus.Planned]: false,
  [ActionStatus.OfficeAction]: false,
  [ActionStatus.MemberAction]: true,
  [ActionStatus.Resolution]: true,
  [ActionStatus.Completed]: true,
  [ActionStatus.Failed]: true,
  [ActionStatus.Abandoned]: true,
} as const satisfies Record<ActionStatus, boolean>;

/**
 * Has the launch a preview previews already happened, as of `at`? Reading the
 * status as well as the member-action event covers an action that reaches a
 * later status without one, which a preview would otherwise run on for good,
 * since nothing else lowers the flag. The event still counts on its own, so an
 * action that opened and was then walked back to an earlier status stays spent
 * rather than re-arming.
 */
export function memberActionHasOpened(
  events: Pick<ActionEvent, "date" | "newStatus">[] | undefined,
  at: Date,
): boolean {
  if (!events) {
    throw new Error("memberActionHasOpened needs the events relation loaded");
  }
  return (
    hasMemberActionStarted(events, at) ||
    launchHasHappenedIn[actionStatusAt(events, at)]
  );
}

/**
 * A preview runs until the launch it previews, and archiving retires it early:
 * an abandoned one would otherwise sit on its viewers' home pages for good,
 * since only a launch clears the flag. What members can already read of the
 * action in the meantime — a planned one sits on the actions list — is
 * untouched: the flag only ever adds a viewer.
 */
export function isStaffPreviewActive(
  action: Pick<Action, "archived" | "events" | "staffPreview">,
  now: Date,
): boolean {
  // Ordered before the flag check, so a caller that skipped the events relation
  // fails on every action rather than on the day someone arms a preview.
  return (
    !memberActionHasOpened(action.events, now) &&
    action.staffPreview &&
    !action.archived
  );
}

/**
 * Is this viewer one a preview is up for? Admins are, as well as staff: they
 * keep every admin-facing view through `userCanSeeAction`, which answers them
 * before this rule.
 */
export function canSeeStaffPreview(
  user: Pick<User, "admin" | "staff"> | null,
): boolean {
  return !!user && (user.admin || user.staff);
}

/**
 * Is a preview up, and is this the viewer it is up for? The single spelling of
 * the pair, so no caller writes half of it, and every caller inherits the
 * ordering {@link isStaffPreviewActive} needs.
 */
export function isStaffPreviewFor(params: {
  action: Pick<Action, "archived" | "events" | "staffPreview">;
  user: Pick<User, "admin" | "staff"> | null;
  now: Date;
}): boolean {
  const { action, user, now } = params;
  return isStaffPreviewActive(action, now) && canSeeStaffPreview(user);
}

/**
 * Completion-permission rule — the pure core of
 * `ActionsService.isCompletionAllowed` (the `ActionDto.canParticipate` wire
 * field and the server-side gate on the complete mutation).
 *
 * Policy (decided 2026-07): contract state is NOT a completion gate for
 * regular actions — a lapsed/suspended in-cohort member may still complete.
 * Onboarding actions keep the join-timing contract gate because the onboarding
 * sequence exists to get the contract signed. Dismissal and away never block
 * completion.
 */
export function computeCanCompleteAction(params: {
  action: Pick<
    Action,
    | "archived"
    | "preventCompletion"
    | "onboarding"
    | "memberActionPhase"
    | "staffPreview"
    | "events"
  >;
  user: Pick<User, "admin" | "contractEvents" | "staff">;
  inCohort: boolean;
  now: Date;
}): boolean {
  const { action, user, inCohort, now } = params;

  // The same line `StaffPreviewService.assertWritable` draws, so the wire field
  // and the refusal behind it agree on who is turned away.
  if (action.preventCompletion || isStaffPreviewFor({ action, user, now })) {
    return false;
  }
  if (!inCohort) {
    return false;
  }
  if (
    action.onboarding &&
    !computeContractSignedAfterOnboardingStart({
      user,
      memberActionPhaseStart: action.memberActionPhase.event?.date ?? null,
    })
  ) {
    return false;
  }
  return true;
}

/**
 * Resolves the viewer's {@link UserActionStatus} for one action. Pure —
 * callers fetch, this computes:
 *
 * - `inCohort` must be the cohort-expression result evaluated regardless of
 *   dismissal (dismissal is an overlay here, not an assignment input).
 * - `activities` are the viewer's activities on this action, all types.
 */
export function resolveUserActionStatus(params: {
  action: Pick<
    Action,
    | "archived"
    | "events"
    | "memberActionPhase"
    | "onboarding"
    | "optional"
    | "preventCompletion"
    | "staffPreview"
  >;
  user: Pick<
    User,
    | "admin"
    | "contractEvents"
    | "hasActiveContractInFullRange"
    | "awayRanges"
    | "isAwayAtAnyPointInRange"
    | "staff"
  >;
  inCohort: boolean;
  activities: Pick<
    ActionActivity,
    "type" | "createdAt" | "declineReason" | "isMoral" | "outOfTime"
  >[];
  now: Date;
}): UserActionStatus {
  const { action, user, inCohort, activities, now } = params;

  const dismissed = activities.some(
    (activity) => activity.type === ActionActivityType.USER_DISMISSED,
  );

  const terminal = findLatestTerminalActivity(activities);
  let relation = ViewerActionRelation.None;
  let withdrawal: UserActionWithdrawal | null = null;
  let activityStatus: UserActionRelationPillStatus | null = null;
  if (terminal) {
    switch (terminal.type) {
      case ActionActivityType.USER_COMPLETED:
        relation = ViewerActionRelation.Completed;
        activityStatus = UserActionRelationPillStatus.Completed;
        break;
      case ActionActivityType.USER_WONT_COMPLETE:
        relation = ViewerActionRelation.Withdrawn;
        activityStatus = UserActionRelationPillStatus.WontComplete;
        withdrawal = {
          reason: withdrawalOptionFromFlags({
            outOfTime: !!terminal.outOfTime,
            isMoral: !!terminal.isMoral,
          }),
          note: terminal.declineReason ?? null,
        };
        break;
      default:
        throw new Error(
          `unknown terminal activity type: ${terminal.type satisfies never}`,
        );
    }
  }

  const assigned = computeIsAssignedToAction({
    action,
    user,
    inCohort,
    // Dismissal is an overlay, not an assignment input (unlike the legacy
    // `shouldParticipate` field, which still folds it in).
    dismissed: false,
  });

  const awayDuringWindow = computeIsAwayDuringWindow({ action, user });

  // Single-user equivalent of the participant roster
  // (`findParticipantIdsForActions`, the `usersJoined` counter):
  // "expected to act ∪ completed anyway".
  const isParticipant =
    relation === ViewerActionRelation.Completed ||
    (assigned &&
      !awayDuringWindow &&
      relation !== ViewerActionRelation.Withdrawn);

  const deadlineAt = action.memberActionPhase.deadlineEvent?.date ?? null;
  const deadlinePassed = !!deadlineAt && deadlineAt <= now;
  const preview = isStaffPreviewFor({ action, user, now });

  return {
    assigned,
    canComplete: computeCanCompleteAction({ action, user, inCohort, now }),
    relation,
    withdrawal,
    dismissed,
    away: computeMemberActionAwayStatus({ action, user, now }),
    memberActionStarted: hasMemberActionStarted(action.events, now),
    deadlineAt,
    deadlinePassed,
    display: resolveUserActionPillStatus({
      isJoined: isParticipant,
      isAway: inCohort && awayDuringWindow,
      optional: action.optional,
      deadlinePassed,
      activityStatus,
    }),
    preview,
    discussionClosed: preview && actionHiddenFromMembers(action, now),
  };
}
