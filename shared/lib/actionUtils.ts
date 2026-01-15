import {
  ActionDto,
  ActionEventDto,
  UserActionRelationDetailDto,
  UserAwayRangeDto,
} from "../client";

export enum FilterMode {
  All = "All",
  GatheringCommitments = "Gathering commitments",
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
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0]
    : null;
};

export function getActionEventAt(
  action: ActionDto,
  date: Date
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
  date: Date
): TaskAwayStatus {
  const lastMemberActionEvent = action.events.find(
    (event) =>
      new Date(event.date) <= date && event.newStatus === "member_action"
  );
  if (!lastMemberActionEvent) {
    return TaskAwayStatus.NOT_AWAY;
  }

  const { event, endDate } = getActionEventAt(
    action,
    new Date(lastMemberActionEvent.date)
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

export function getDeadlineTimestamp(action: ActionDto): number {
  let i = 0;
  // Find first 'member_action' or 'gathering_commitments' event
  while (
    action.events[i] &&
    action.events[i].newStatus !== "member_action" &&
    action.events[i].newStatus !== "gathering_commitments"
  ) {
    i++;
  }

  // Find next non-'member_action' or 'gathering_commitments' event
  while (
    action.events[i] &&
    (action.events[i].newStatus === "member_action" ||
      action.events[i].newStatus === "gathering_commitments")
  ) {
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
      (event) => event.newStatus === "member_action"
    ) &&
    (action.userRelation === "joined" ||
      (action.commitmentless && action.userRelation !== "completed")) &&
    action.userRelation !== "declined" &&
    (action.canParticipate || action.publicOnly)
  );
}

export function shouldCompleteAction(action: ActionDto) {
  return (
    canCompleteAction(action) &&
    action.shouldParticipate &&
    (action.status === "member_action" ||
      action.status === "gathering_commitments" ||
      (action.shouldCompleteAfterDeadline &&
        deadlineHasPassed(action, new Date()))) &&
    !action.publicOnly
  );
}

export function isCurrentlyCompletedAction(action: ActionDto) {
  return (
    action.shouldParticipate &&
    (action.status === "member_action" ||
      action.status === "gathering_commitments") &&
    !action.everyoneShouldComplete &&
    action.userRelation === "completed"
  );
}

export function canJoinAction(action: ActionDto) {
  return (
    action.status === "gathering_commitments" &&
    action.userRelation === "none" &&
    action.canParticipate
  );
}

export function showActionInSidebarList(action: ActionWithAwayStatus) {
  return (
    (shouldCompleteAction(action) || canJoinAction(action)) &&
    action.awayStatus === TaskAwayStatus.NOT_AWAY &&
    !deadlineHasPassed(action, new Date()) &&
    action.userRelation !== "dismissed"
  );
}

export function deadlineHasPassed(action: ActionDto, date: Date): boolean {
  return (
    action.status !== "member_action" &&
    action.status !== "gathering_commitments" &&
    action.events.some(
      (event) =>
        new Date(event.date) < date &&
        (event.newStatus === "member_action" ||
          event.newStatus === "gathering_commitments")
    )
  );
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
  const anyComplete = new Set<number>();
  const anyIncomplete = new Set<number>();
  for (const [userIdKey, relationDetails] of Object.entries(
    userActionRelations
  )) {
    const userId = Number(userIdKey);
    for (const relationDetail of relationDetails) {
      if (!filteredActionIdSet.has(relationDetail.actionId)) {
        continue;
      }
      if (relationDetail.status === "completed") {
        anyComplete.add(userId);
      }
      if (relationDetail.status === "todo") {
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
