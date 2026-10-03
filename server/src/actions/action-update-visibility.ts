import { LessThanOrEqual, type FindOptionsWhere } from "typeorm";
import type { ActionUpdate } from "./entities/action-update.entity";

/**
 * `visibleAt` stays null until the first body save. SQL comparisons exclude
 * null, so this predicate also keeps empty drafts out of member-facing reads.
 */
export function publishedActionUpdateWhere(
  now: Date,
): FindOptionsWhere<ActionUpdate> {
  return { visibleAt: LessThanOrEqual(now) };
}

export function isActionUpdatePublished(
  update: Pick<ActionUpdate, "visibleAt">,
  now: Date,
): boolean {
  return update.visibleAt !== null && update.visibleAt <= now;
}

/** When an update's inbox entries come due: not before members can see it. */
export function actionUpdateEntrySendTime(
  update: Pick<ActionUpdate, "date" | "visibleAt">,
): Date {
  const { date, visibleAt } = update;
  return visibleAt && visibleAt > date ? visibleAt : date;
}
