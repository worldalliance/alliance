import {
  NotificationDto,
  NotificationSourceType,
  UnreadContentType,
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

export function isClearedByContentRead(params: {
  notification: NotificationDto;
  contentType: UnreadContentType;
  contentIds: Set<number>;
}) {
  const { notification, contentType, contentIds } = params;
  return (
    !notification.readAt &&
    notification.contentType === contentType &&
    notification.contentId !== undefined &&
    contentIds.has(notification.contentId)
  );
}
