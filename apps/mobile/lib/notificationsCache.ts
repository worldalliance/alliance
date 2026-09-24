import { NotificationDto, UnreadContentType } from "@alliance/shared/client";
import { QueryClient } from "@tanstack/react-query";

export function markCachedNotificationsReadByContent(params: {
  queryClient: QueryClient;
  contentType: UnreadContentType;
  contentIds: number[];
}) {
  const { queryClient, contentType, contentIds } = params;
  const ids = new Set(contentIds);
  const readAt = new Date().toISOString();
  queryClient.setQueryData<NotificationDto[]>(["notifications"], (oldData) =>
    oldData?.map((notification) =>
      notification.readAt ||
      notification.contentType !== contentType ||
      notification.contentId === undefined ||
      !ids.has(notification.contentId)
        ? notification
        : { ...notification, readAt },
    ),
  );
  void queryClient.invalidateQueries({
    queryKey: ["notifications", "unreadCount"],
    exact: true,
  });
}
