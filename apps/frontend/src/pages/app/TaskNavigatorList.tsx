import { withCount } from "@alliance/common/plural";
import { FollowUpFormDto } from "@alliance/shared/client";
import {
  ActionWithAwayStatus,
  homePagePriorityComparator,
} from "@alliance/shared/lib/actionUtils";
import {
  compareFollowUpFormsByStartDateDesc,
  type ActiveFollowUpFormEntry,
} from "@alliance/shared/lib/homePage";
import { useMemo } from "react";
import { WalkthroughAnchor } from "../../onboarding/walkthrough/steps";
import {
  TaskNavigatorCompletedRow,
  TaskNavigatorTodoActionRow,
} from "./TaskNavigatorRow";

/** Ordered queue of main-column cards (action or follow-up) driven by the task navigator list. */
export type TaskNavigatorItem =
  | { kind: "action"; action: ActionWithAwayStatus }
  | { kind: "followUpForm"; followUpForm: FollowUpFormDto; actionId: number };

export default function TaskNavigatorList({
  actions,
  completedActions,
  currentWeekTodoActions,
  nextWeekTodoActions,
  remainingTasksEstimatedTimeCurrentWeek,
  activeCompletableFollowUpForms,
  items,
  selectedItem,
  onSelectIndex,
}: {
  actions: ActionWithAwayStatus[];
  completedActions: ActionWithAwayStatus[];
  currentWeekTodoActions: ActionWithAwayStatus[];
  nextWeekTodoActions: ActionWithAwayStatus[];
  remainingTasksEstimatedTimeCurrentWeek: number;
  activeCompletableFollowUpForms: ActiveFollowUpFormEntry[];
  items: TaskNavigatorItem[];
  selectedItem: TaskNavigatorItem | undefined;
  onSelectIndex: (index: number) => void;
}) {
  const followUpFormsByActionId = useMemo(() => {
    const map: Record<number, FollowUpFormDto[]> = {};
    for (const { followUpForm, actionId } of activeCompletableFollowUpForms) {
      (map[actionId] ??= []).push(followUpForm);
    }
    for (const forms of Object.values(map)) {
      forms.sort(compareFollowUpFormsByStartDateDesc);
    }
    return map;
  }, [activeCompletableFollowUpForms]);

  const followUpParentActionsNotInCompletedList = useMemo(() => {
    const completedIds = new Set(completedActions.map((a) => a.id));
    const orphanIds = new Set<number>();
    for (const { actionId } of activeCompletableFollowUpForms) {
      if (!completedIds.has(actionId)) {
        orphanIds.add(actionId);
      }
    }
    return actions
      .filter((a) => orphanIds.has(a.id))
      .sort(homePagePriorityComparator);
  }, [actions, activeCompletableFollowUpForms, completedActions]);

  const hasTaskSectionContent =
    currentWeekTodoActions.length > 0 ||
    nextWeekTodoActions.length > 0 ||
    completedActions.length > 0 ||
    followUpParentActionsNotInCompletedList.length > 0;
  if (!hasTaskSectionContent) {
    return null;
  }

  const activeActionId =
    selectedItem?.kind === "action" ? selectedItem.action.id : null;
  const activeFollowUpFormId =
    selectedItem?.kind === "followUpForm" ? selectedItem.followUpForm.id : null;

  const selectWhere = (predicate: (item: TaskNavigatorItem) => boolean) => {
    const idx = items.findIndex(predicate);
    if (idx >= 0) {
      onSelectIndex(idx);
    }
  };

  const todoActionRow = (
    action: ActionWithAwayStatus,
    showOptionalPrefix: boolean,
  ) => (
    <TaskNavigatorTodoActionRow
      key={action.id}
      action={action}
      isActive={action.id === activeActionId}
      showOptionalPrefix={showOptionalPrefix}
      onSelect={() =>
        selectWhere((c) => c.kind === "action" && c.action.id === action.id)
      }
    />
  );

  return (
    <div
      className="overflow-hidden"
      data-walkthrough={WalkthroughAnchor.TaskList}
    >
      <div className="flex flex-col gap-y-2">
        {currentWeekTodoActions.length > 0 && (
          <p className="text-zinc-600 mb-1">
            <span className="text-green font-medium mr-0.5">
              {currentWeekTodoActions.length} left
            </span>
            {remainingTasksEstimatedTimeCurrentWeek > 0 &&
              ` (${withCount(
                remainingTasksEstimatedTimeCurrentWeek,
                "minute",
              )} required)`}
          </p>
        )}

        <div className="flex flex-col gap-y-1">
          {[
            ...completedActions,
            ...followUpParentActionsNotInCompletedList,
          ].map((action) => (
            <TaskNavigatorCompletedRow
              key={action.id}
              action={action}
              followUpForms={followUpFormsByActionId[action.id] ?? []}
              activeFollowUpFormId={activeFollowUpFormId}
              onSelectFollowUp={(formId) =>
                selectWhere(
                  (c) =>
                    c.kind === "followUpForm" &&
                    c.actionId === action.id &&
                    c.followUpForm.id === formId,
                )
              }
            />
          ))}

          {currentWeekTodoActions.map((action) => todoActionRow(action, true))}
          {nextWeekTodoActions.length > 0 && (
            <>
              <div className="pt-2">
                <p className="text-zinc-500 font-medium">Upcoming</p>
              </div>
              {nextWeekTodoActions.map((action) =>
                todoActionRow(action, false),
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
