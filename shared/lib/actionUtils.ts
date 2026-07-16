import {
  ActionDto,
  CommunityUserInfoDto,
  GeneralUpdateDto,
  TaskAwayStatus,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
} from "../client";

type TaskPriority = {
  priority: number;
  deadlineTimestamp: number;
  startTimestamp: number;
  typePriority: number;
};

type GeneralUpdatePriorityFields = Pick<
  GeneralUpdateDto,
  "priority" | "endDate" | "startDate"
>;
type ActionPriorityFields = Pick<ActionDto, "priority" | "events">;

export function isGeneralUpdate(
  a: GeneralUpdatePriorityFields | ActionPriorityFields,
): a is GeneralUpdatePriorityFields {
  return !("events" in a);
}

function generalUpdatePriority(
  generalUpdate: GeneralUpdatePriorityFields,
): TaskPriority {
  return {
    priority: generalUpdate.priority,
    deadlineTimestamp: generalUpdate.endDate
      ? new Date(generalUpdate.endDate).getTime()
      : Infinity,
    startTimestamp: generalUpdate.startDate
      ? new Date(generalUpdate.startDate).getTime()
      : -Infinity,
    typePriority: 1,
  };
}

function actionPriority(action: ActionPriorityFields): TaskPriority {
  const startDateString = action.events.find(
    (event) => event.newStatus === "member_action",
  )?.date;
  return {
    priority: action.priority,
    deadlineTimestamp: getDeadlineTimestamp(action),
    startTimestamp: startDateString
      ? new Date(startDateString).getTime()
      : -Infinity,
    typePriority: 0,
  };
}

function generalUpdateOrActionPriority(
  a: GeneralUpdatePriorityFields | ActionPriorityFields,
): TaskPriority {
  if (isGeneralUpdate(a)) {
    return generalUpdatePriority(a);
  }
  return actionPriority(a);
}

export function homePagePriorityComparator(
  a: GeneralUpdatePriorityFields | ActionPriorityFields,
  b: GeneralUpdatePriorityFields | ActionPriorityFields,
): number {
  const aPriority = generalUpdateOrActionPriority(a);
  const bPriority = generalUpdateOrActionPriority(b);

  // Sort by priority, highest priority first
  if (aPriority.priority !== bPriority.priority) {
    return bPriority.priority - aPriority.priority;
  }

  // Sort by earliest deadline first
  if (aPriority.deadlineTimestamp !== bPriority.deadlineTimestamp) {
    return aPriority.deadlineTimestamp - bPriority.deadlineTimestamp;
  }

  // Sort by earliest start date
  if (aPriority.startTimestamp !== bPriority.startTimestamp) {
    return aPriority.startTimestamp - bPriority.startTimestamp;
  }

  // Sort by type priority, highest priority first
  if (aPriority.typePriority !== bPriority.typePriority) {
    return bPriority.typePriority - aPriority.typePriority;
  }

  return 0;
}

export function isFollowUpFormActive(f: {
  startDate?: string | null;
  endDate?: string | null;
}): boolean {
  const now = new Date();
  if (!f.startDate || new Date(f.startDate) > now) {
    return false;
  }
  if (f.endDate && new Date(f.endDate) < now) {
    return false;
  }
  return true;
}

export enum FilterMode {
  All = "All",
  CompletedByMe = "Completed by me",
  MemberAction = "Members taking action",
  PendingOfficeResolution = "Pending office resolution",
  Past = "Past",
}

export type ActionWithAwayStatus = ActionDto & { awayStatus: TaskAwayStatus };

export function getDeadlineTimestamp(
  action: Pick<ActionDto, "events">,
): number {
  let i = 0;
  // Find first 'member_action' event
  while (action.events[i] && action.events[i].newStatus !== "member_action") {
    i++;
  }

  // Find next non-'member_action' event
  while (action.events[i] && action.events[i].newStatus === "member_action") {
    i++;
  }

  const nextEvent = action.events[i];
  if (!nextEvent) {
    return Infinity;
  }

  return new Date(nextEvent.date).getTime();
}

export function canCompleteAction(action: ActionDto) {
  return (
    action.events
      .filter((event) => new Date(event.date) <= new Date())
      .some((event) => event.newStatus === "member_action") &&
    action.userRelation !== "completed" &&
    action.userRelation !== "declined" &&
    (action.canParticipate || action.publicOnly)
  );
}

export function shouldCompleteAction(action: ActionDto) {
  return (
    canCompleteAction(action) &&
    action.shouldParticipate &&
    (action.status === "member_action" ||
      (action.shouldCompleteAfterDeadline &&
        deadlineHasPassed(action, new Date()))) &&
    !action.publicOnly
  );
}

export function isCurrentlyCompletedAction(action: ActionDto) {
  return (
    action.shouldParticipate &&
    action.status === "member_action" &&
    !action.onboarding &&
    action.userRelation === "completed"
  );
}

export function showActionInSidebarList(action: ActionWithAwayStatus) {
  return (
    shouldCompleteAction(action) &&
    action.awayStatus === "not_away" &&
    !deadlineHasPassed(action, new Date()) &&
    action.userRelation !== "dismissed"
  );
}

export function deadlineHasPassed(action: ActionDto, date: Date): boolean {
  return (
    action.status !== "member_action" &&
    action.events.some(
      (event) =>
        new Date(event.date) < date && event.newStatus === "member_action",
    )
  );
}

const STATUS_TO_COMPLETION: Record<
  UserActionRelationDetailDto["status"],
  "complete" | "incomplete" | "none"
> = {
  away: "none",
  completed: "complete",
  missed_deadline: "none",
  not_required: "none",
  optional_task: "none",
  todo: "incomplete",
  wont_complete: "none",
};

export type CompletionData = {
  completedAllCurrentActions: Record<number, boolean>;
  nActions: number;
  nCompleted: number;
  nTotal: number;
};

/** One (user, status) pair feeding completion aggregation. */
type CompletionObservation = {
  userId: number;
  status: UserActionRelationDetailDto["status"];
};

/**
 * Shared core for completion aggregation. A user counts as having completed
 * everything only when none of their observed statuses are `incomplete` (see
 * {@link STATUS_TO_COMPLETION}); users with only `none` statuses are omitted
 * entirely. Callers supply their own iteration order, so this stays
 * O(observations) regardless of how they're grouped.
 */
function summarizeCompletion(observations: Iterable<CompletionObservation>): {
  completedAllCurrentActions: Record<number, boolean>;
  nCompleted: number;
  nTotal: number;
} {
  const anyComplete = new Set<number>();
  const anyIncomplete = new Set<number>();
  for (const { userId, status } of observations) {
    const completion = STATUS_TO_COMPLETION[status];
    if (completion === "complete") {
      anyComplete.add(userId);
    }
    if (completion === "incomplete") {
      anyIncomplete.add(userId);
    }
  }

  const completedAllCurrentActions: Record<number, boolean> =
    Object.fromEntries(
      Array.from(new Set([...anyComplete, ...anyIncomplete])).map((userId) => [
        userId,
        !anyIncomplete.has(userId),
      ]),
    );
  const completedAllValues = Object.values(completedAllCurrentActions);

  return {
    completedAllCurrentActions,
    nCompleted: completedAllValues.filter((completed) => completed).length,
    nTotal: completedAllValues.length,
  };
}

export function calculateCompletionData(params: {
  filteredActionIds: number[];
  userActionRelations: Record<number, UserActionRelationDetailDto[]>;
}): {
  completedAllCurrentActions: Record<number, boolean>;
  nCompleted: number;
  nTotal: number;
} {
  const { filteredActionIds, userActionRelations } = params;
  const filteredActionIdSet = new Set(filteredActionIds);

  function* observe(): Generator<CompletionObservation> {
    for (const [userIdKey, relationDetails] of Object.entries(
      userActionRelations,
    )) {
      const userId = Number(userIdKey);
      for (const relationDetail of relationDetails) {
        if (!filteredActionIdSet.has(relationDetail.actionId)) {
          continue;
        }
        yield { userId, status: relationDetail.status };
      }
    }
  }

  return summarizeCompletion(observe());
}

export function calculateAllCompletionData(params: {
  actions: CommunityUserInfoDto["actions"];
  users: CommunityUserInfoDto["users"];
  actionDeadlineWindowMs: number;
}):
  | {
      previous: undefined;
      current: CompletionData;
    }
  | {
      previous: CompletionData;
      current: undefined;
    } {
  const { actions, users, actionDeadlineWindowMs } = params;

  const relationDetailByActionThenUser = users.reduce(
    (acc, { userId, relations }) => {
      for (const relation of relations) {
        let details = acc.get(relation.actionId);
        if (!details) {
          details = new Map();
          acc.set(relation.actionId, details);
        }

        details.set(userId, relation);
      }
      return acc;
    },
    new Map<number, Map<number, UserActionRelationDetailDto>>(),
  );

  function completionDataForActions(
    actionSummaries: UserActionSummaryDto[],
  ): CompletionData {
    function* observe(): Generator<CompletionObservation> {
      for (const action of actionSummaries) {
        const relationDetailByUser = relationDetailByActionThenUser.get(
          action.id,
        );
        if (!relationDetailByUser) {
          continue;
        }
        for (const [userId, relationDetail] of relationDetailByUser) {
          yield { userId, status: relationDetail.status };
        }
      }
    }

    return {
      ...summarizeCompletion(observe()),
      nActions: actionSummaries.length,
    };
  }

  const actionsWithUserRelations = actions.filter(
    (
      action,
    ): action is typeof action & {
      memberActionDeadline: number;
    } =>
      action.memberActionDeadline !== null &&
      completionDataForActions([action]).nTotal > 0,
  );
  if (actionsWithUserRelations.length === 0) {
    return {
      previous: undefined,
      current: completionDataForActions([]),
    };
  }

  const activeActions = actionsWithUserRelations.filter(
    (action) => action.status === "member_action",
  );
  if (activeActions.length === 0) {
    const previousActions = actionsWithUserRelations.filter(
      (action) => action.memberActionDeadline < Date.now(),
    );
    if (previousActions.length === 0) {
      return {
        previous: undefined,
        current: completionDataForActions([]),
      };
    }

    const latestPreviousDeadline = Math.max(
      ...previousActions.map((action) => action.memberActionDeadline),
    );
    const selectedPreviousActions = previousActions.filter(
      (action) =>
        action.memberActionDeadline >=
        latestPreviousDeadline - actionDeadlineWindowMs,
    );
    return {
      previous: completionDataForActions(selectedPreviousActions),
      current: undefined,
    };
  }

  const earliestDeadline = Math.min(
    ...activeActions.map((action) => action.memberActionDeadline),
  );
  const currentActions = activeActions.filter(
    (action) =>
      action.memberActionDeadline < earliestDeadline + actionDeadlineWindowMs,
  );

  return {
    previous: undefined,
    current: completionDataForActions(currentActions),
  };
}
