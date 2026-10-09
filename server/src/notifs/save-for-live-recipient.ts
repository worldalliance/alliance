import { ActionEvent } from "src/actions/entities/action-event.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import { lockLive, updateLive } from "src/datasources/soft-delete";
import { Push } from "src/push/push.entity";
import { User } from "src/user/entities/user.entity";
import { type DataSource, type EntityManager, In } from "typeorm";
import type { NotificationPlan } from "./dto/notification-plan.dto";
import { ActionEventNotif } from "./entities/action-event-notif.entity";

/** Saves nothing and resolves to null once the suite, the member event, the
 * group or the member is deleted, so a run planned before does not start
 * sending under it. */
export function saveForLiveRecipient(
  dataSource: DataSource,
  params: { plan: NotificationPlan; notif: ActionEventNotif },
): Promise<ActionEventNotif | null> {
  const { plan, notif } = params;
  return dataSource.transaction(async (manager) =>
    // An action's deletion locks its member event before the group.
    (await lockLive(manager, [
      ...(notif.actionSuite
        ? [{ target: ActionSuite, id: notif.actionSuite.id }]
        : []),
      { target: ActionEvent, id: plan.group.memberActionEvent.id },
      { target: ReminderGroup, id: plan.group.id },
      { target: User, id: plan.user.id },
    ]))
      ? manager.save(notif)
      : null,
  );
}

/** Records a finished delivery on the notice even once its group is gone, so
 * coverage by member event still counts it. */
export function recordDelivery(
  manager: EntityManager,
  notif: ActionEventNotif,
): Promise<void> {
  const pushIds = (notif.pushes ?? []).map((push) => push.id);
  return manager.transaction(async (em) => {
    if (pushIds.length > 0) {
      await em.update(
        Push,
        { id: In(pushIds) },
        { actionEventNotif: { id: notif.id } },
      );
    }
    await updateLive(em, {
      target: ActionEventNotif,
      id: notif.id,
      changes: {
        sent: notif.sent,
        mail: notif.mail ?? null,
        mms: notif.mms ?? null,
        ...(notif.notification && {
          notification: { id: notif.notification.id },
        }),
      },
    });
  });
}
