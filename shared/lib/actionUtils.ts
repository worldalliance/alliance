import {
  ActionDto,
  ActionEventDto,
  CommunityUserInfoDto,
  GeneralUpdateDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
  UserAwayRangeDto,
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

export const getPastEvents = (action: ActionDto) => {
  return action.events.filter((event) => new Date(event.date) <= new Date());
};

export const getLatestEvent = (action: ActionDto) => {
  const pastEvents = getPastEvents(action);
  return pastEvents.length > 0
    ? pastEvents.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )[0]
    : null;
};

export function getActionEventAt(
  action: ActionDto,
  date: Date,
): { event: ActionEventDto | null; endDate: Date | null } {
  const event = action.events.find((event) => new Date(event.date) <= date);
  const nextEvent = action.events.find((event) => new Date(event.date) > date);

  return {
    event: event ?? null,
    endDate: nextEvent ? new Date(nextEvent.date) : null,
  };
}

export enum TaskAwayStatus {
  AWAY_PREVIOUSLY = "away_previously",
  AWAY_CURRENTLY = "away_currently",
  AWAY_LATER = "away_later",
  NOT_AWAY = "not_away",
}

export function getAwayStatus(
  action: ActionDto,
  awayRanges: UserAwayRangeDto[],
  date: Date,
): TaskAwayStatus {
  const memberActionEvent = action.events.find(
    (event) =>
      new Date(event.date) <= date && event.newStatus === "member_action",
  );
  if (!memberActionEvent) {
    return TaskAwayStatus.NOT_AWAY;
  }

  const { event, endDate } = getActionEventAt(
    action,
    new Date(memberActionEvent.date),
  );

  if (!event) {
    return TaskAwayStatus.NOT_AWAY;
  }
  const startDate = new Date(event.date);

  for (const awayRange of awayRanges) {
    const awayStartDate = new Date(awayRange.startDate);
    const awayEndDate = new Date(awayRange.endDate);
    if (awayStartDate <= date && date < awayEndDate) {
      return TaskAwayStatus.AWAY_CURRENTLY;
    }

    if (startDate < awayEndDate && awayEndDate < date) {
      return TaskAwayStatus.AWAY_PREVIOUSLY;
    }

    if (date <= awayStartDate && (!endDate || awayStartDate < endDate)) {
      return TaskAwayStatus.AWAY_LATER;
    }
  }
  return TaskAwayStatus.NOT_AWAY;
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
    getPastEvents(action).some(
      (event) => event.newStatus === "member_action",
    ) &&
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
    !action.everyoneShouldComplete &&
    action.userRelation === "completed"
  );
}

export function showActionInSidebarList(action: ActionWithAwayStatus) {
  return (
    shouldCompleteAction(action) &&
    action.awayStatus === TaskAwayStatus.NOT_AWAY &&
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
  missed_deadline: "incomplete",
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
  const anyComplete = new Set<number>();
  const anyIncomplete = new Set<number>();
  for (const [userIdKey, relationDetails] of Object.entries(
    userActionRelations,
  )) {
    const userId = Number(userIdKey);
    for (const relationDetail of relationDetails) {
      if (!filteredActionIdSet.has(relationDetail.actionId)) {
        continue;
      }
      const completion = STATUS_TO_COMPLETION[relationDetail.status];
      if (completion === "complete") {
        anyComplete.add(userId);
      }
      if (completion === "incomplete") {
        anyIncomplete.add(userId);
      }
    }
  }

  const completedAllCurrentActions: Record<number, boolean> = {};
  for (const userIdKey of Object.keys(userActionRelations)) {
    const userId = Number(userIdKey);
    if (anyComplete.has(userId)) {
      completedAllCurrentActions[userId] = true;
    }
    if (anyIncomplete.has(userId)) {
      completedAllCurrentActions[userId] = false;
    }
  }
  const completedAllValues = Object.values(completedAllCurrentActions);

  return {
    completedAllCurrentActions,
    nCompleted: completedAllValues.filter((completed) => completed).length,
    nTotal: completedAllValues.length,
  };
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

  function calculateCompletionData(
    actionIds: UserActionSummaryDto[],
  ): CompletionData {
    const { anyComplete, anyIncomplete } = actionIds.reduce(
      (acc, action) => {
        const relationDetailByUser = relationDetailByActionThenUser.get(
          action.id,
        );
        if (!relationDetailByUser) {
          return acc;
        }
        for (const [userId, relationDetail] of relationDetailByUser) {
          const completion = STATUS_TO_COMPLETION[relationDetail.status];
          if (completion === "complete") {
            acc.anyComplete.add(userId);
          }
          if (completion === "incomplete") {
            acc.anyIncomplete.add(userId);
          }
        }
        return acc;
      },
      {
        anyComplete: new Set<number>(),
        anyIncomplete: new Set<number>(),
      },
    );

    const completedAllCurrentActions = Object.fromEntries(
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
      nActions: actionIds.length,
    };
  }

  const actionsWithUserRelations = actions.filter(
    (
      action,
    ): action is typeof action & {
      memberActionDeadline: number;
    } =>
      action.memberActionDeadline !== null &&
      calculateCompletionData([action]).nTotal > 0,
  );
  if (actionsWithUserRelations.length === 0) {
    return {
      previous: undefined,
      current: calculateCompletionData([]),
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
        current: calculateCompletionData([]),
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
      previous: calculateCompletionData(selectedPreviousActions),
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
    current: calculateCompletionData(currentActions),
  };
}
