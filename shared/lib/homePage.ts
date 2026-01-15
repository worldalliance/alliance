import { useCallback, useMemo } from "react";
import { ActionDto } from "../client";
import {
  ActionWithAwayStatus,
  canJoinAction,
  getDeadlineTimestamp,
  isCurrentlyCompletedAction,
  shouldCompleteAction,
  showActionInSidebarList,
} from "./actionUtils";

export function actionPriorityComparator(
  actionA: ActionDto,
  actionB: ActionDto
): number {
  // Sort by priority
  if (actionA.priority !== actionB.priority) {
    return actionB.priority - actionA.priority;
  }

  // Sort by earliest deadline first
  const deadlineA = getDeadlineTimestamp(actionA);
  const deadlineB = getDeadlineTimestamp(actionB);
  if (deadlineA !== Infinity || deadlineB !== Infinity) {
    return deadlineA - deadlineB;
  }

  // Both do not have deadlines: sort by earliest member action
  const memberActionA = actionA.events.find(
    (event) =>
      event.newStatus === "member_action" ||
      event.newStatus === "gathering_commitments"
  );
  if (!memberActionA) {
    return 1;
  }
  const memberActionB = actionB.events.find(
    (event) =>
      event.newStatus === "member_action" ||
      event.newStatus === "gathering_commitments"
  );
  if (!memberActionB) {
    return -1;
  }
  return (
    new Date(memberActionA.date).getTime() -
    new Date(memberActionB.date).getTime()
  );
}

export function useHomePageActions(actions: ActionWithAwayStatus[] | null) {
  const todoActions = useMemo(() => {
    return (
      actions?.filter(shouldCompleteAction).sort(actionPriorityComparator) ?? []
    );
  }, [actions]);

  const newActions =
    actions
      ?.filter((action) => canJoinAction(action))
      .sort((a, b) => {
        return b.priority - a.priority;
      }) || [];

  const isActionDeadlineWithinDays = useCallback(
    (action: ActionDto, days: number) => {
      const deadlineEvent = action.events.find(
        (event) => event.newStatus === "office_action"
      );
      if (!deadlineEvent) {
        return true;
      }
      return (
        new Date(deadlineEvent.date) <
        new Date(new Date().setDate(new Date().getDate() + days))
      );
    },
    []
  );

  const doesCurrentWeekHaveActions = useMemo(
    () =>
      todoActions.some((action) => {
        return isActionDeadlineWithinDays(action, 7);
      }),
    [todoActions, isActionDeadlineWithinDays]
  );

  const isActionInCurrentWeek = useCallback(
    (action: ActionDto) => {
      if (doesCurrentWeekHaveActions) {
        return isActionDeadlineWithinDays(action, 7);
      } else {
        return isActionDeadlineWithinDays(action, 14);
      }
    },
    [doesCurrentWeekHaveActions, isActionDeadlineWithinDays]
  );

  const currentTask: ActionWithAwayStatus | null =
    (newActions.length > 0 && newActions[0]) ||
    (todoActions.length > 0 && todoActions[0]) ||
    null;

  const currentWeekTodoActions = todoActions.filter((action) => {
    return showActionInSidebarList(action) && isActionInCurrentWeek(action);
  });
  const nextWeekTodoActions = todoActions.filter((action) => {
    return showActionInSidebarList(action) && !isActionInCurrentWeek(action);
  });

  const remainingTasksEstimatedTimeCurrentWeek = currentWeekTodoActions.reduce(
    (sum, action) => {
      if (
        showActionInSidebarList(action) &&
        !action.optional &&
        action.timeEstimate
      ) {
        return sum + action.timeEstimate;
      }
      return sum;
    },
    0
  );

  const completedActions = useMemo(() => {
    return (
      actions?.filter((action) => isCurrentlyCompletedAction(action)) || []
    );
  }, [actions]);

  return {
    todoActions,
    newActions,
    currentTask,
    currentWeekTodoActions,
    nextWeekTodoActions,
    remainingTasksEstimatedTimeCurrentWeek,
    completedActions,
  };
}
