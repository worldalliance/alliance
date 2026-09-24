import { NotificationDto, UnreadContentType } from "@alliance/shared/client";
import { isClearedByContentRead } from "@alliance/shared/lib/notificationIdentity";
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
      isClearedByContentRead({ notification, contentType, contentIds: ids })
        ? { ...notification, readAt }
        : notification,
    ),
  );
  void queryClient.invalidateQueries({
    queryKey: ["notifications", "unreadCount"],
    exact: true,
  });
}
