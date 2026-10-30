import type { QueryClient } from "@tanstack/react-query";
import type { NotificationDto } from "../../client";
import { notificationStore, type NotificationList } from "../notificationStore";
import { queryKeys } from "../queryKeys";

export function seedNotifications(params: {
  client: QueryClient;
  notifications: NotificationDto[];
  limit?: number;
  loadedAt?: string;
}) {
  params.client.setQueryData<NotificationList>(
    queryKeys.notificationsList(params.limit),
    {
      keys: notificationStore(params.client).receive(params.notifications),
      loadedAt: params.loadedAt ?? null,
    },
  );
}
