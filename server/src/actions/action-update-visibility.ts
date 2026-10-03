import { R, type Result } from "@alliance/common/result";
import { addMilliseconds, max } from "date-fns";
import { LessThanOrEqual, type FindOptionsWhere } from "typeorm";
import { ActionStatus, type ActionEvent } from "./entities/action-event.entity";
import type { ActionUpdate } from "./entities/action-update.entity";
import { actionStatusAt } from "./entities/action.entity";

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

/** Whether members can see the action when the update's entries arrive; the failure is the reason to show the admin. */
export function checkActionShowsWhenEntriesArrive(params: {
  action: {
    archived: boolean;
    events: Pick<ActionEvent, "date" | "newStatus">[];
  };
  actionUpdate: Pick<ActionUpdate, "date" | "visibleAt">;
  now: Date;
}): Result<void, string> {
  if (params.action.archived) {
    return R.failure(
      "This action is archived, so members can't see it. Unarchive it before sending the notification.",
    );
  }
  // Entries due in the past arrive now. An event dated at the arrival has
  // taken effect by then.
  const arrival = max([
    actionUpdateEntrySendTime(params.actionUpdate),
    params.now,
  ]);
  if (
    actionStatusAt(params.action.events, addMilliseconds(arrival, 1)) ===
    ActionStatus.Draft
  ) {
    return R.failure(
      "This action is still a draft when the notification arrives. Date the update on or after the action's launch, or send it once the action has launched.",
    );
  }
  return R.success(undefined);
}
