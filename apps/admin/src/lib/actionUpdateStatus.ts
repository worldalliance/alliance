import type { ActionUpdateDto } from "@alliance/shared/client";

export enum ActionUpdateStatus {
  Draft = "draft",
  Scheduled = "scheduled",
  Published = "published",
}

export const ACTION_UPDATE_STATUS_LABELS: Record<ActionUpdateStatus, string> = {
  [ActionUpdateStatus.Draft]: "Draft",
  [ActionUpdateStatus.Scheduled]: "Scheduled",
  [ActionUpdateStatus.Published]: "Published",
};

/** Matches the server's rule: members see an update once `visibleAt` passes. */
export function actionUpdateStatus(
  update: Pick<ActionUpdateDto, "visibleAt">,
  now: Date,
): ActionUpdateStatus {
  if (update.visibleAt === null) return ActionUpdateStatus.Draft;
  return new Date(update.visibleAt) > now
    ? ActionUpdateStatus.Scheduled
    : ActionUpdateStatus.Published;
}
