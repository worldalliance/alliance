import {
  NotificationDto,
  NotificationSourceType,
} from "@alliance/shared/client";

export function getNotificationIdentityKey(
  notification: Pick<NotificationDto, "id" | "sourceType">,
) {
  return `${notification.sourceType}:${notification.id}`;
}

export function getNotificationReadRequest(
  notification: Pick<NotificationDto, "id" | "sourceType">,
) {
  return {
    path: { id: notification.id },
    query: { sourceType: notification.sourceType as NotificationSourceType },
  };
}
