import { isFollowUpFormActive } from "@alliance/common/followUpForm";
import { useCallback, useMemo } from "react";
import { ActionDto, FollowUpFormDto } from "../client";
import {
  ActionWithAwayStatus,
  homePagePriorityComparator,
  isActionOptional,
  isCurrentlyCompletedAction,
  isDeferredForViewer,
  shouldCompleteAction,
  showActionInSidebarList,
} from "./actionUtils";
import type { ParsedGeneralUpdate } from "./generalUpdates";

export type ActiveFollowUpFormEntry = {
  followUpForm: FollowUpFormDto;
  actionId: number;
};

export function useHomePageActions(actions: ActionWithAwayStatus[] | null) {
  const todoActions = useMemo(
    () =>
      withDeferredLast(
        actions
          ?.filter(shouldCompleteAction)
          .sort(homePagePriorityComparator) ?? [],
        isDeferredForViewer,
      ),
    [actions],
  );

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
      if (!isActionOptional(action) && action.timeEstimate) {
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

export function followUpStartTimeMs(f: FollowUpFormDto): number {
  return f.startDate ? new Date(f.startDate).getTime() : Infinity;
}
export function compareFollowUpFormsByStartDateDesc(
  a: FollowUpFormDto,
  b: FollowUpFormDto,
): number {
  return followUpStartTimeMs(b) - followUpStartTimeMs(a);
}

export type HomeSequenceItem =
  | { kind: "action"; action: ActionWithAwayStatus }
  | { kind: "generalUpdate"; generalUpdate: ParsedGeneralUpdate };

export function interleaveActionsAndUpdates(params: {
  todoActions: ActionWithAwayStatus[];
  generalUpdates: ParsedGeneralUpdate[];
}): HomeSequenceItem[] {
  const sorted = [
    ...params.todoActions.map(
      (action) => ({ kind: "action", action }) as const,
    ),
    ...params.generalUpdates.map(
      (generalUpdate) => ({ kind: "generalUpdate", generalUpdate }) as const,
    ),
  ].sort((a, b) =>
    homePagePriorityComparator(
      a.kind === "action" ? a.action : a.generalUpdate,
      b.kind === "action" ? b.action : b.generalUpdate,
    ),
  );
  return withDeferredLast(
    sorted,
    (item) => item.kind === "action" && isDeferredForViewer(item.action),
  );
}

function withDeferredLast<T>(sorted: T[], isDeferred: (item: T) => boolean) {
  return [
    ...sorted.filter((item) => !isDeferred(item)),
    ...sorted.filter(isDeferred),
  ];
}
