/** @fileoverview Utils for relationships between actions and users */
import type { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionStatus,
  type ActionEvent,
} from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import type { Community } from "src/community/entities/community.entity";
import type { FormResponse } from "src/tasks/entities/formresponse.entity";
import { User } from "src/user/entities/user.entity";
import { findLeast } from "src/utils/filter";
import type { Repository } from "typeorm";

/**
 * Onboarding "joined in time?" gate. Targets *new* members, so a user qualifies
 * only if their first contract was signed at or after the member-action phase began.
 *
 * Edge cases:
 * - No contract events → in time (brand-new signup).
 * - Contract event but no phase start → out of time: can't onboard into a phase
 *   that hasn't started.
 *
 * Single source of this rule, shared by {@link computeAssignmentCore}
 * (both assignment variants, i.e. the `ActionDto.shouldParticipate` wire field)
 * and `ActionsService.isCompletionAllowed` (the `ActionDto.canParticipate`
 * wire field).
 */
export function computeContractSignedAfterOnboardingStart(params: {
  user: Pick<User, "contractEvents">;
  memberActionPhaseStart: Date | null;
}): boolean {
  const { user, memberActionPhaseStart } = params;

  const earliestContractEvent = findLeast(
    user.contractEvents ?? [],
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  if (!earliestContractEvent) {
    return true;
  }
  if (!memberActionPhaseStart) {
    return false;
  }
  return earliestContractEvent.date >= memberActionPhaseStart;
}

/**
 * How strongly a user is held to an action.
 *
 * `Optional` is the mid-window joiner: in the cohort and holding a contract by
 * the end of the member-action window, but without one across the whole of it.
 * The action reaches their home page and they may complete it, but nothing
 * holds them to it — no reminders, no suspension accounting, no missed
 * deadline.
 */
export enum ActionAssignment {
  Unassigned = "unassigned",
  Optional = "optional",
  Required = "required",
}

/** What the shared rule can decide without a clock. */
enum CoreAssignment {
  Unassigned = "unassigned",
  /** In the cohort, but without a contract across the whole window. */
  ContractGap = "contract_gap",
  Required = "required",
}

/**
 * Shared assignment rule behind every variant: dismissal, cohort membership,
 * and the contract requirement — onboarding actions need the first contract
 * signed at/after the phase start; all others need an active contract across
 * the whole member-action window (`deadlineDate: null` = open-ended).
 *
 * NOTE: the dismissal exclusion still lives here for now; the target model
 * treats dismissal as an overlay, not part of assignment. It moves out when
 * `viewer.status` lands.
 */
function computeAssignmentCore(params: {
  /** Member-action phase start; also the onboarding join-timing reference. */
  eventDate: Date;
  deadlineDate: Date | null;
  inCohort: boolean;
  dismissed: boolean;
  onboarding: boolean;
  user: Pick<User, "contractEvents" | "hasActiveContractInFullRange">;
  /**
   * Skip the contract-lapse exclusion (analytics wants the historical base
   * set and handles contract state itself).
   */
  includeSuspended?: boolean;
  includeDismissed?: boolean;
}): CoreAssignment {
  const {
    eventDate,
    deadlineDate,
    inCohort,
    dismissed,
    onboarding,
    user,
    includeSuspended = false,
    includeDismissed = false,
  } = params;

  if (!includeDismissed && dismissed) {
    return CoreAssignment.Unassigned;
  }
  if (!inCohort) {
    return CoreAssignment.Unassigned;
  }
  if (onboarding) {
    return computeContractSignedAfterOnboardingStart({
      user,
      memberActionPhaseStart: eventDate,
    })
      ? CoreAssignment.Required
      : CoreAssignment.Unassigned;
  }
  return includeSuspended ||
    user.hasActiveContractInFullRange({
      startDate: eventDate,
      endDate: deadlineDate,
    })
    ? CoreAssignment.Required
    : CoreAssignment.ContractGap;
}

type SelfViewParams = {
  action: Pick<Action, "events" | "memberActionPhase" | "onboarding">;
  user: Pick<
    User,
    "contractEvents" | "hasActiveContractInFullRange" | "hasActiveContractAt"
  > | null;
  inCohort: boolean;
  dismissed: boolean;
};

function computeSelfViewCore(params: SelfViewParams): CoreAssignment {
  const { action, user, inCohort, dismissed } = params;
  const { event, deadlineEvent } = action.memberActionPhase;
  if (!user || !event) {
    return CoreAssignment.Unassigned;
  }
  return computeAssignmentCore({
    eventDate: event.date,
    deadlineDate: deadlineEvent?.date ?? null,
    inCohort,
    dismissed,
    onboarding: action.onboarding,
    user,
  });
}

/**
 * Self-view "how is this user assigned this action?" predicate — source of the
 * viewer's own `ActionDto.shouldParticipate` and of `viewer.assigned` /
 * `viewer.optional`.
 *
 * A contract that covers the window's end but not the whole window is the
 * `Optional` case, once the phase has opened. Anchoring on the end rather than
 * on `now` keeps actions that closed before the user ever signed `Unassigned`,
 * so a new member's history doesn't fill with optional entries for actions
 * they missed.
 *
 * Distinct from {@link computeIsAssignedFromCohortSet} (the event-recipient variant
 * driven by a precomputed cohort-member set, for notifications/roster). This one
 * consumes the live cohort result (`computeIsInActionCohort`) as `inCohort`,
 * and stays pure/sync so the caller controls when the DB-hitting cohort
 * evaluation runs. Both delegate to {@link computeAssignmentCore}.
 */
export function computeActionAssignment(
  params: SelfViewParams & { now: Date },
): ActionAssignment {
  const { action, user, now } = params;
  const core = computeSelfViewCore(params);
  switch (core) {
    case CoreAssignment.Required:
      return ActionAssignment.Required;
    case CoreAssignment.Unassigned:
      return ActionAssignment.Unassigned;
    case CoreAssignment.ContractGap: {
      const { event, deadlineEvent } = action.memberActionPhase;
      // Only once the phase has opened: the viewer copy for this case says the
      // task has already been open.
      return user &&
        event &&
        event.date <= now &&
        user.hasActiveContractAt(deadlineEvent?.date ?? now)
        ? ActionAssignment.Optional
        : ActionAssignment.Unassigned;
    }
    default:
      throw new Error(`unknown core assignment: ${core satisfies never}`);
  }
}

/**
 * {@link computeActionAssignment} narrowed to `Required`, for callers that
 * must agree with the roster ({@link computeIsAssignedFromCohortSet}).
 */
export function computeIsRequiredForAction(params: SelfViewParams): boolean {
  return computeSelfViewCore(params) === CoreAssignment.Required;
}

/**
 * Window-overlap away check: is the user away at *any* point during the whole
 * member-action phase? Time-independent. Used for participation rosters and the
 * `usersJoined` counter — i.e. "could this user have done it at all?".
 *
 * Distinct from {@link computeMemberActionAwayStatus}, which is the now-relative
 * 4-valued status the UI renders. Two different questions; don't conflate them.
 */
export function computeIsAwayDuringWindow(params: {
  action: Pick<Action, "events" | "memberActionPhase">;
  user: Pick<User, "awayRanges" | "isAwayAtAnyPointInRange">;
}): boolean {
  const { action, user } = params;

  const { event: memberActionEvent, deadlineEvent } = action.memberActionPhase;

  if (!memberActionEvent) {
    return false;
  }

  return user.isAwayAtAnyPointInRange({
    startDate: memberActionEvent.date,
    endDate: deadlineEvent?.date ?? null,
  });
}

/**
 * Now-relative away status for a user's member action, as rendered on the home
 * feed (away banner, sidebar visibility, task-count badge).
 *
 * This is the single source of truth that used to live on the client as
 * `getAwayStatusAt` in `shared/lib/actionUtils.ts`. It is surfaced on
 * `ActionDto.awayStatus` so clients read a field instead of recomputing it.
 *
 * Distinct from {@link computeIsAwayDuringWindow} (window-overlap
 * boolean for rosters/counters).
 */
export enum TaskAwayStatus {
  AwayPreviously = "away_previously",
  AwayCurrently = "away_currently",
  AwayLater = "away_later",
  NotAway = "not_away",
}

function findActionEventWindowAt(
  events: { date: Date }[],
  date: Date,
): { startDate: Date | null; endDate: Date | null } {
  const event = events.find((e) => e.date <= date) ?? null;
  const nextEvent = events.find((e) => e.date > date) ?? null;
  return { startDate: event?.date ?? null, endDate: nextEvent?.date ?? null };
}

/**
 * The first loaded member-action event that has already opened
 * (`date <= now`), or undefined when no member-action phase has started. Any
 * past member-action event counts (not just the latest phase's), so a
 * re-scheduled action whose earlier phase already ran still reads started.
 */
export function findStartedMemberActionEvent<
  E extends Pick<ActionEvent, "date" | "newStatus">,
>(events: E[], now: Date): E | undefined {
  return events.find(
    (event) =>
      event.date <= now && event.newStatus === ActionStatus.MemberAction,
  );
}

/** Has a member-action phase opened? See {@link findStartedMemberActionEvent}. */
export function hasMemberActionStarted(
  events: Pick<ActionEvent, "date" | "newStatus">[],
  now: Date,
): boolean {
  return findStartedMemberActionEvent(events, now) !== undefined;
}

export function hasMemberActionDeadlinePassed(
  deadline: Date | null | undefined,
  now: Date,
): boolean {
  return !!deadline && deadline <= now;
}

/**
 * Action-level half of {@link computeMissedActionDeadline}; when false, nobody
 * missed the deadline, so callers can skip loading members. Optional actions
 * show `optional_task` rather than `missed_deadline`.
 */
export function canMissActionDeadline(
  action: Pick<Action, "optional" | "memberActionPhase">,
  now: Date,
): boolean {
  return (
    !action.optional &&
    hasMemberActionDeadlinePassed(
      action.memberActionPhase.deadlineEvent?.date,
      now,
    )
  );
}

/**
 * The `MissedActionDeadline` cohort leaf for one member, shared by the
 * single-user and population cohort paths: required and present for the
 * action, deadline passed, no completion or withdrawal. Dismissal does not
 * count; it is a view-only overlay offered on past-deadline cards.
 */
export function computeMissedActionDeadline(params: {
  action: SelfViewParams["action"] & Pick<Action, "optional">;
  user: NonNullable<SelfViewParams["user"]> &
    Pick<User, "awayRanges" | "isAwayAtAnyPointInRange">;
  inCohort: boolean;
  hasTerminalActivity: boolean;
  now: Date;
}): boolean {
  const { action, user, inCohort, hasTerminalActivity, now } = params;
  return (
    canMissActionDeadline(action, now) &&
    !hasTerminalActivity &&
    computeIsRequiredForAction({ action, user, inCohort, dismissed: false }) &&
    !computeIsAwayDuringWindow({ action, user })
  );
}

export function computeMemberActionAwayStatus(params: {
  action: Pick<Action, "events">;
  user: Pick<User, "awayRanges">;
  now: Date;
}): TaskAwayStatus {
  const { action, user, now } = params;

  const memberActionEvent = findStartedMemberActionEvent(action.events, now);
  if (!memberActionEvent) {
    return TaskAwayStatus.NotAway;
  }

  const { startDate, endDate } = findActionEventWindowAt(
    action.events,
    memberActionEvent.date,
  );
  if (!startDate) {
    return TaskAwayStatus.NotAway;
  }

  for (const awayRange of user.awayRanges ?? []) {
    const { startDate: awayStartDate, endDate: awayEndDate } = awayRange;
    if (awayStartDate <= now && now < awayEndDate) {
      return TaskAwayStatus.AwayCurrently;
    }
    if (startDate < awayEndDate && awayEndDate < now) {
      return TaskAwayStatus.AwayPreviously;
    }
    if (now <= awayStartDate && (!endDate || awayStartDate < endDate)) {
      return TaskAwayStatus.AwayLater;
    }
  }
  return TaskAwayStatus.NotAway;
}

/**
 * Optional repositories/services for evaluating advanced cohort leaf types.
 * When provided, CompletedAction, InProgressAction, FormFieldValue, and
 * GroupLead expressions will be evaluated properly. Without them, those
 * leaf types return false.
 */
export interface CohortEvaluationDeps {
  actionActivityRepository?: Repository<ActionActivity>;
  formResponseRepository?: Repository<FormResponse>;
  communityRepository?: Repository<Community>;
}

// --- Legacy functions for GeneralUpdate compatibility ---

export function computeIsTaggedOrInManualCohortAction(params: {
  user: User;
  action: Action;
  includeSuspended: boolean;
}): boolean {
  const { user, action, includeSuspended } = params;

  return computeIsTaggedOrInManualCohort({
    user,
    useManualCohort: false,
    manualCohortUserIdSet: null,
    participatingTagIdSet: new Set<string>(),
    onboarding: action.onboarding,
    memberActionEventDate: action.memberActionPhase?.event?.date,
    memberActionEventDeadline: action.memberActionPhase?.deadlineEvent?.date,
    includeSuspended,
  });
}

export function computeIsTaggedOrInManualCohort(params: {
  user: Pick<User, "id" | "tags" | "hasActiveContractInFullRange">;
  useManualCohort: boolean;
  manualCohortUserIdSet: Set<number> | null;
  participatingTagIdSet: Set<string>;
  onboarding: boolean;
  memberActionEventDate: Date | undefined | null;
  memberActionEventDeadline: Date | undefined | null;
  includeSuspended: boolean;
}): boolean {
  const {
    user,
    useManualCohort,
    manualCohortUserIdSet,
    participatingTagIdSet,
    onboarding,
    memberActionEventDate,
    memberActionEventDeadline,
    includeSuspended,
  } = params;

  if (useManualCohort) {
    return !!manualCohortUserIdSet?.has(user.id);
  }

  return (
    user.tags.some((tag) => participatingTagIdSet.has(tag.id)) &&
    (includeSuspended ||
      onboarding ||
      user.hasActiveContractInFullRange({
        startDate: memberActionEventDate,
        endDate: memberActionEventDeadline,
      }))
  );
}

/**
 * Roster variant of the assignment predicate: is this user *required* to do
 * this action, given a precomputed cohort-member id set? Same rule as
 * {@link computeActionAssignment} (cohort membership, dismissal, onboarding
 * rules, contract dates) but shaped for bulk evaluation over many users.
 * Runs per member-action event, so `eventDate` is the phase start.
 *
 * Deliberately narrower than `computeActionAssignment`: this roster drives
 * reminders, suspension accounting and the participant counter, none of which
 * a mid-window joiner belongs in, so a contract gap reads false here.
 */
export function computeIsAssignedFromCohortSet(params: {
  eventDate: Date;
  deadlineDate: Date | null;
  cohortMemberIds: Set<number>;
  user: User;
  userDismissed: boolean;
  onboarding: boolean;
  includeSuspended?: boolean;
  includeDismissed?: boolean;
}): boolean {
  const {
    eventDate,
    deadlineDate,
    cohortMemberIds,
    user,
    userDismissed,
    onboarding,
    includeSuspended,
    includeDismissed,
  } = params;

  return (
    computeAssignmentCore({
      eventDate,
      deadlineDate,
      inCohort: cohortMemberIds.has(user.id),
      dismissed: userDismissed,
      onboarding,
      user,
      includeSuspended,
      includeDismissed,
    }) === CoreAssignment.Required
  );
}

/**
 * "Assigned and present" roster predicate: {@link computeIsAssignedFromCohortSet}
 * AND not away at any point during the member-action window. Single source
 * for every consumer of the participation roster — notification recipients
 * (`ActionEventRecipientService`) and suite stats (`ActionsService`) — so a
 * user the roster/pill counts as away is consistently excluded everywhere.
 * `user` must have `awayRanges` loaded.
 */
export function computeIsAssignedAndPresent(
  params: Parameters<typeof computeIsAssignedFromCohortSet>[0],
): boolean {
  const { user, eventDate, deadlineDate } = params;
  return (
    computeIsAssignedFromCohortSet(params) &&
    !user.isAwayAtAnyPointInRange({
      startDate: eventDate,
      endDate: deadlineDate,
    })
  );
}
