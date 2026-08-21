import { useCallback, useMemo } from "react";
import { ActionDto, FollowUpForm } from "../client";
import {
  ActionWithAwayStatus,
  homePagePriorityComparator,
  isCurrentlyCompletedAction,
  isFollowUpFormActive,
  shouldCompleteAction,
  showActionInSidebarList,
} from "./actionUtils";

export type ActiveFollowUpFormEntry = {
  followUpForm: FollowUpForm;
  actionId: number;
};

export function useHomePageActions(actions: ActionWithAwayStatus[] | null) {
  const todoActions = useMemo(() => {
    return (
      actions?.filter(shouldCompleteAction).sort(homePagePriorityComparator) ??
      []
    );
  }, [actions]);

  const isActionDeadlineWithinDays = useCallback(
    (action: ActionDto, days: number) => {
      const deadlineEvent = action.events.find(
        (event) => event.newStatus === "office_action",
      );
      if (!deadlineEvent) {
        return true;
      }
      return (
        new Date(deadlineEvent.date) <
        new Date(new Date().setDate(new Date().getDate() + days))
      );
    },
    [],
  );

  const doesCurrentWeekHaveActions = useMemo(
    () =>
      todoActions.some((action) => {
        return isActionDeadlineWithinDays(action, 7);
      }),
    [todoActions, isActionDeadlineWithinDays],
  );

  const isActionInCurrentWeek = useCallback(
    (action: ActionDto) => {
      if (doesCurrentWeekHaveActions) {
        return isActionDeadlineWithinDays(action, 7);
      } else {
        return isActionDeadlineWithinDays(action, 14);
      }
    },
    [doesCurrentWeekHaveActions, isActionDeadlineWithinDays],
  );

  const currentTask: ActionWithAwayStatus | null =
    (todoActions.length > 0 && todoActions[0]) || null;

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
    0,
  );

  const completedActions = useMemo(() => {
    return (
      actions?.filter((action) => isCurrentlyCompletedAction(action)) || []
    );
  }, [actions]);

  const activeCompletableFollowUpForms = useMemo<
    ActiveFollowUpFormEntry[]
  >(() => {
    if (!actions) return [];
    const list: ActiveFollowUpFormEntry[] = [];
    for (const action of actions) {
      if (action.userRelation !== "completed") continue;
      for (const f of action.followUpForms) {
        if (isFollowUpFormActive(f)) {
          list.push({ followUpForm: f, actionId: action.id });
        }
      }
    }
    return list.sort(
      (a, b) =>
        followUpStartTimeMs(b.followUpForm) -
        followUpStartTimeMs(a.followUpForm),
    );
  }, [actions]);

  return {
    todoActions,
    currentTask,
    currentWeekTodoActions,
    nextWeekTodoActions,
    remainingTasksEstimatedTimeCurrentWeek,
    completedActions,
    activeCompletableFollowUpForms,
  };
}

export function followUpStartTimeMs(f: FollowUpForm): number {
  return f.startDate ? new Date(f.startDate).getTime() : Infinity;
}
export function compareFollowUpFormsByStartDateDesc(
  a: FollowUpForm,
  b: FollowUpForm,
): number {
  return followUpStartTimeMs(b) - followUpStartTimeMs(a);
}
