import type { AggregateViewSchema } from "@alliance/common/forms/form-schema";
import type { ActionDto } from "@alliance/shared/client";
import { isActionAssignedAndNotDismissed } from "@alliance/shared/lib/actionUtils";

function isSidebarProgressCandidate(
  action: ActionDto,
): action is ActionDto & { taskFormId: number } {
  return (
    action.status === "member_action" &&
    isActionAssignedAndNotDismissed(action) &&
    action.taskFormId != null
  );
}

export function sidebarProgressFormIds(actions: ActionDto[]): number[] {
  return actions
    .filter(isSidebarProgressCandidate)
    .map((action) => action.taskFormId);
}

export type SidebarProgressBarEntry = {
  action: ActionDto;
  progressBars: AggregateViewSchema[];
};

export function buildSidebarProgressBarEntries(
  actions: ActionDto[],
  viewsByFormId: Record<number, AggregateViewSchema[]>,
): SidebarProgressBarEntry[] {
  return actions
    .filter(isSidebarProgressCandidate)
    .map((action) => ({
      action,
      progressBars: viewsByFormId[action.taskFormId] ?? [],
    }))
    .filter(({ progressBars }) => progressBars.length > 0);
}
