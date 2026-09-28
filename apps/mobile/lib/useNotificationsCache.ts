import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import {
  NotificationDto,
  notifsFindAll,
  notifsGetUnreadCount,
  notifsSetReadAll,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  QueryClient,
  queryOptions,
  skipToken,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";

const LIST_KEY = queryKeys.notifications();
const LOADED_AT_KEY = queryKeys.notificationsLoadedAt();
const UNREAD_COUNT_KEY = queryKeys.notificationsUnreadCount();

export function notificationsCache(queryClient: QueryClient) {
  return {
    list: queryOptions({
      queryKey: LIST_KEY,
      queryFn: async ({ signal }) => {
        const res = await notifsFindAll({ signal });
        queryClient.setQueryData(
          LOADED_AT_KEY,
          res.response.headers.get(NOTIFS_LOADED_AT_HEADER),
        );
        return res.data;
      },
    }),

    unreadCount: queryOptions({
      queryKey: UNREAD_COUNT_KEY,
      queryFn: () =>
        notifsGetUnreadCount().then(
          (response) => response.data?.unreadCount ?? 0,
        ),
    }),

    refresh: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),

    markAllRead: async () => {
      await queryClient.cancelQueries({ queryKey: LIST_KEY });

      const prevNotifications =
        queryClient.getQueryData<NotificationDto[]>(LIST_KEY);
      const prevUnreadCount =
        queryClient.getQueryData<number>(UNREAD_COUNT_KEY);

      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationDto[]>(LIST_KEY, (oldData) =>
        oldData?.map((notification) => ({ ...notification, readAt })),
      );
      queryClient.setQueryData<number>(UNREAD_COUNT_KEY, 0);

      try {
        const loadedAt = queryClient.getQueryData<string | null>(LOADED_AT_KEY);
        await notifsSetReadAll({ query: { loadedAt: loadedAt ?? undefined } });
        // Rows that came due after the load stay unread, so the list and
        // count refetch to show them.
        void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      } catch {
        if (prevNotifications !== undefined) {
          queryClient.setQueryData(LIST_KEY, prevNotifications);
        } else {
          void queryClient.invalidateQueries({ queryKey: LIST_KEY });
        }

        if (prevUnreadCount !== undefined) {
          queryClient.setQueryData(UNREAD_COUNT_KEY, prevUnreadCount);
        } else {
          void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
        }
      }
    },
  };
}

export function useNotificationsCache() {
  const queryClient = useQueryClient();
  return useMemo(() => notificationsCache(queryClient), [queryClient]);
}

export function useNotificationsList() {
  const query = useQuery(useNotificationsCache().list);

  // Observed so the cache keeps it as long as the list it came with.
  useQuery<string | null>({ queryKey: LOADED_AT_KEY, queryFn: skipToken });

  return query;
}

export function useUnreadNotificationCount() {
  return useQuery(useNotificationsCache().unreadCount).data ?? 0;
}
