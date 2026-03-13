/** @fileoverview Utils for relationships between actions and users */
import { Action } from 'src/actions/entities/action.entity';
import { User } from 'src/user/entities/user.entity';
import type { Repository } from 'typeorm';
import type { ActionActivity } from 'src/actions/entities/action-activity.entity';
import type { FormResponse } from 'src/tasks/entities/formresponse.entity';
import type { Community } from 'src/community/entities/community.entity';

export function computeIsContractActiveDuringEntireLatestMemberAction(params: {
  action: Pick<Action, 'events' | 'latestMemberActionEvent'>;
  user: Pick<User, 'contractEvents' | 'hasActiveContractInFullRange'>;
}): boolean {
  const { action, user } = params;
  const { event: latestMemberActionEvent, deadline } =
    action.latestMemberActionEvent;

  if (!latestMemberActionEvent) {
    return false;
  }

  return user.hasActiveContractInFullRange({
    startDate: latestMemberActionEvent.date,
    endDate: deadline,
  });
}

export function computeIsAwayDuringAnyOfLastMemberAction(params: {
  action: Pick<Action, 'events' | 'latestMemberActionEvent'>;
  user: Pick<User, 'awayRanges' | 'isAwayAtAnyPointInRange'>;
}): boolean {
  const { action, user } = params;

  const { event: lastMemberActionEvent, deadline } =
    action.latestMemberActionEvent;

  if (!lastMemberActionEvent) {
    return false;
  }

  return user.isAwayAtAnyPointInRange({
    startDate: lastMemberActionEvent.date,
    endDate: deadline,
  });
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
    everyoneShouldComplete: action.everyoneShouldComplete,
    latestMemberActionEventDate: action.latestMemberActionEvent?.event?.date,
    latestMemberActionEventDeadline: action.latestMemberActionEvent?.deadline,
    includeSuspended,
  });
}

export function computeIsTaggedOrInManualCohort(params: {
  user: Pick<User, 'id' | 'tags' | 'hasActiveContractInFullRange'>;
  useManualCohort: boolean;
  manualCohortUserIdSet: Set<number> | null;
  participatingTagIdSet: Set<string>;
  everyoneShouldComplete: boolean;
  latestMemberActionEventDate: Date | undefined | null;
  latestMemberActionEventDeadline: Date | undefined | null;
  includeSuspended: boolean;
}): boolean {
  const {
    user,
    useManualCohort,
    manualCohortUserIdSet,
    participatingTagIdSet,
    everyoneShouldComplete,
    latestMemberActionEventDate,
    latestMemberActionEventDeadline,
    includeSuspended,
  } = params;

  if (useManualCohort) {
    return !!manualCohortUserIdSet?.has(user.id);
  }

  return (
    user.tags.some((tag) => participatingTagIdSet.has(tag.id)) &&
    (includeSuspended ||
      everyoneShouldComplete ||
      user.hasActiveContractInFullRange({
        startDate: latestMemberActionEventDate,
        endDate: latestMemberActionEventDeadline,
      }))
  );
}
