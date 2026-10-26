import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import { joinMessage } from "src/notifs/notification-content";
import type { CreateNotifParams } from "src/notifs/notifs.service";
import { reinstatementMessage } from "src/notifs/textnotifcontents";
import { tasksUrl } from "src/search/approutes";
import { ContractEvent } from "src/user/entities/contract-event.entity";
import type { EntityManager } from "typeorm";

export const reinstatementNotif = (params: {
  userId: number;
  suspensionId: number;
}): CreateNotifParams => ({
  user: { id: params.userId },
  category: NotificationCategory.ContractReinstated,
  message: joinMessage([reinstatementMessage]),
  destination: null,
  webAppLocation: tasksUrl(),
  mobileAppLocation: tasksUrl(),
  associatedUsers: [],
  // The reinstated listener pushes it directly, after checking it is current.
  shouldPush: false,
  reinstatedSuspensionId: params.suspensionId,
});

/**
 * Saves the notification unless another signing already announced the end of
 * its suspension. The lock on the suspension makes a concurrent claim wait for
 * this one to commit, then see it.
 */
export async function claimReinstatement(
  em: EntityManager,
  claim: { notif: Notification; suspensionId: number },
): Promise<number | null> {
  const { notif, suspensionId } = claim;
  await em.findOneOrFail(ContractEvent, {
    where: { id: suspensionId },
    lock: { mode: "pessimistic_write" },
  });
  if (
    await em.exists(Notification, {
      where: { reinstatedSuspensionId: suspensionId },
      withDeleted: true,
    })
  ) {
    return null;
  }
  return (await em.save(notif)).id;
}
