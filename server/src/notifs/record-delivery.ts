import { updateLive } from "src/datasources/soft-delete";
import { Push } from "src/push/push.entity";
import { type EntityManager, In } from "typeorm";
import { ActionEventNotif } from "./entities/action-event-notif.entity";

/** Writes the notice's delivery state even once its group is gone, so
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
