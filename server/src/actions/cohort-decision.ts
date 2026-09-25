import type { User } from "src/user/entities/user.entity";
import {
  computeContractSignedAfterOnboardingStart,
  hasMemberActionDeadlinePassed,
} from "src/utils/action-user";
import type { Action } from "./entities/action.entity";

export enum CohortEnrollmentState {
  NotStarted = "not_started",
  Open = "open",
  Closed = "closed",
}

export type CohortEnrollment =
  | { state: CohortEnrollmentState.NotStarted }
  | { state: CohortEnrollmentState.Open; start: Date }
  | { state: CohortEnrollmentState.Closed; start: Date; deadline: Date };

/**
 * Whether the resolver may issue ordinary decisions for an action. A regular
 * action stops at its member-action deadline, matching the late-signer cutoff
 * in `computeActionAssignment`. Onboarding never closes, because
 * `computeAssignmentCore` still assigns it to members who join after its
 * deadline.
 */
export function computeCohortEnrollment(
  action: Pick<Action, "onboarding" | "memberActionPhase">,
  now: Date,
): CohortEnrollment {
  const { event, deadlineEvent } = action.memberActionPhase;
  if (!event || event.date > now) {
    return { state: CohortEnrollmentState.NotStarted };
  }
  if (
    !action.onboarding &&
    deadlineEvent &&
    hasMemberActionDeadlinePassed(deadlineEvent.date, now)
  ) {
    return {
      state: CohortEnrollmentState.Closed,
      start: event.date,
      deadline: deadlineEvent.date,
    };
  }
  return { state: CohortEnrollmentState.Open, start: event.date };
}

/**
 * Whether the resolver can decide this member at `at`. A member it cannot
 * admit gets no row, so a regular action's unsigned account stays free to
 * enroll by signing later.
 */
export function isCohortAdmissible(params: {
  action: Pick<Action, "onboarding" | "memberActionPhase">;
  user: Pick<User, "contractEvents" | "hasActiveContractAt">;
  at: Date;
}): boolean {
  const { action, user, at } = params;
  const { event } = action.memberActionPhase;
  if (!event) {
    return false;
  }
  return action.onboarding
    ? computeContractSignedAfterOnboardingStart({
        user,
        memberActionPhaseStart: event.date,
      })
    : user.hasActiveContractAt(at);
}
