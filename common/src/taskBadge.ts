import { z } from "zod";
import { R, type Result } from "./result";

type TaskBadgeStatus =
  | "draft"
  | "planned"
  | "office_action"
  | "member_action"
  | "resolution"
  | "completed"
  | "failed"
  | "abandoned";
type TaskBadgeRelation = "completed" | "withdrawn" | "none";
type TaskBadgeAway =
  | "away_previously"
  | "away_currently"
  | "away_later"
  | "not_away";

export type TaskBadgeAction = {
  status: TaskBadgeStatus;
  publicOnly: boolean;
  viewer?: {
    assigned: boolean;
    dismissed: boolean;
    contractGap: boolean;
    canComplete: boolean;
    memberActionStarted: boolean;
    relation: TaskBadgeRelation;
    away: TaskBadgeAway;
    staffPreview: boolean;
    deadlineAt: Date | string | null;
  };
};

const statusCounts: Record<TaskBadgeStatus, boolean> = {
  draft: false,
  planned: false,
  office_action: false,
  member_action: true,
  resolution: false,
  completed: false,
  failed: false,
  abandoned: false,
};

const relationCounts: Record<TaskBadgeRelation, boolean> = {
  completed: false,
  withdrawn: false,
  none: true,
};

const awayCounts: Record<TaskBadgeAway, boolean> = {
  away_previously: false,
  away_currently: false,
  away_later: false,
  not_away: true,
};

/**
 * Does this action add to the Tasks tab and app-icon badges? Stricter than
 * Home visibility: actions held through a contract gap (admin-optional ones
 * included), staff previews, and past-deadline actions can still show on
 * Home but never count.
 */
export function countsTowardTaskBadge(
  action: TaskBadgeAction,
  now: Date,
): boolean {
  const { viewer } = action;
  if (!viewer) {
    return false;
  }
  return (
    statusCounts[action.status] &&
    !action.publicOnly &&
    !viewer.staffPreview &&
    viewer.assigned &&
    !viewer.dismissed &&
    !viewer.contractGap &&
    viewer.memberActionStarted &&
    viewer.canComplete &&
    relationCounts[viewer.relation] &&
    awayCounts[viewer.away] &&
    (viewer.deadlineAt === null || new Date(viewer.deadlineAt) > now)
  );
}

export function countTaskBadge(actions: TaskBadgeAction[], now: Date): number {
  return actions.filter((action) => countsTowardTaskBadge(action, now)).length;
}

export const taskBadgePushDataSchema = z.object({
  taskBadgeCount: z.number().int().nonnegative(),
});
export type TaskBadgePushData = z.infer<typeof taskBadgePushDataSchema>;

export function parseTaskBadgePush(data: unknown): Result<number, Error> {
  const parsed = taskBadgePushDataSchema.safeParse(data);
  return parsed.success
    ? R.success(parsed.data.taskBadgeCount)
    : R.failure(parsed.error);
}
