import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import {
  NotificationDto,
  notifsFindAll,
  notifsGetUnreadCount,
  notifsSetRead,
  notifsSetReadAll,
  UnreadContentType,
} from "@alliance/shared/client";
import {
  QueryClient,
  queryOptions,
  skipToken,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  getNotificationIdentityKey,
  getNotificationReadRequest,
  isClearedByContentRead,
} from "./notificationIdentity";
import { queryKeys } from "./queryKeys";
import { currentSession } from "./sessionStores";

const ROOT_KEY = queryKeys.notifications();
const LISTS_KEY = queryKeys.notificationsLists();
const UNREAD_COUNT_KEY = queryKeys.notificationsUnreadCount();

function markCachedRead(
  queryClient: QueryClient,
  notificationsToMark: Pick<NotificationDto, "id" | "sourceType">[],
) {
  if (notificationsToMark.length === 0) return;

  const keys = new Set(notificationsToMark.map(getNotificationIdentityKey));
  const readAt = new Date().toISOString();
  let found = false;
  const markedUnread = new Set<string>();
  queryClient.setQueriesData<NotificationDto[]>(
    { queryKey: LISTS_KEY },
    (list) =>
      list?.map((notification) => {
        const key = getNotificationIdentityKey(notification);
        if (!keys.has(key)) return notification;
        found = true;
        if (!notification.readAt) markedUnread.add(key);
        return { ...notification, readAt };
      }),
  );

  if (!found) {
    void queryClient.invalidateQueries({ queryKey: ROOT_KEY });
    return;
  }

  queryClient.setQueryData<number>(UNREAD_COUNT_KEY, (prev) =>
    prev === undefined ? undefined : Math.max(prev - markedUnread.size, 0),
  );
}

export function notificationsCache(queryClient: QueryClient) {
  const refreshIn = (session: number) => {
    if (session === currentSession(queryClient))
      void queryClient.invalidateQueries({ queryKey: ROOT_KEY });
  };

  return {
    list: (limit?: number) =>
      queryOptions({
        queryKey: queryKeys.notificationsList(limit),
        queryFn: async ({ signal }) => {
          const res = await notifsFindAll({
            query: { limit },
            signal,
            throwOnError: true,
          });
          queryClient.setQueryData(
            queryKeys.notificationsLoadedAt(limit),
            res.response.headers.get(NOTIFS_LOADED_AT_HEADER),
          );
          return res.data;
        },
      }),

    unreadCount: queryOptions({
      queryKey: UNREAD_COUNT_KEY,
      queryFn: () =>
        notifsGetUnreadCount({ throwOnError: true }).then(
          (response) => response.data.unreadCount,
        ),
    }),

    refresh: () => queryClient.invalidateQueries({ queryKey: ROOT_KEY }),

    markRead: async (
      notificationsToMark: Pick<NotificationDto, "id" | "sourceType">[],
    ) => {
      const session = currentSession(queryClient);
      markCachedRead(queryClient, notificationsToMark);
      const refused = (
        await Promise.allSettled(
          notificationsToMark.map((notification) =>
            notifsSetRead({
              ...getNotificationReadRequest(notification),
              throwOnError: true,
            }),
          ),
        )
      ).find((result) => result.status === "rejected");
      if (refused) {
        refreshIn(session);
        throw refused.reason;
      }
    },

    markCachedReadByContent: (
      contentType: UnreadContentType,
      contentIds: number[],
    ) => {
      const ids = new Set(contentIds);
      const readAt = new Date().toISOString();
      queryClient.setQueriesData<NotificationDto[]>(
        { queryKey: LISTS_KEY },
        (list) =>
          list?.map((notification) =>
            isClearedByContentRead({
              notification,
              contentType,
              contentIds: ids,
            })
              ? { ...notification, readAt }
              : notification,
          ),
      );
      void queryClient.invalidateQueries({
        queryKey: UNREAD_COUNT_KEY,
        exact: true,
      });
    },

    /** Bounded by the load time of the list with this limit. */
    markAllRead: async (limit?: number) => {
      const session = currentSession(queryClient);
      await queryClient.cancelQueries({ queryKey: ROOT_KEY });
      if (session !== currentSession(queryClient)) return;

      const prevLists = queryClient.getQueriesData<NotificationDto[]>({
        queryKey: LISTS_KEY,
      });
      const prevUnreadCount =
        queryClient.getQueryData<number>(UNREAD_COUNT_KEY);

      const readAt = new Date().toISOString();
      queryClient.setQueriesData<NotificationDto[]>(
        { queryKey: LISTS_KEY },
        (list) => list?.map((notification) => ({ ...notification, readAt })),
      );
      queryClient.setQueryData<number>(UNREAD_COUNT_KEY, 0);

      try {
        const loadedAt = queryClient.getQueryData<string | null>(
          queryKeys.notificationsLoadedAt(limit),
        );
        await notifsSetReadAll({
          query: { loadedAt: loadedAt ?? undefined },
          throwOnError: true,
        });
        // Rows that came due after the load stay unread, so the list and
        // count refetch to show them.
        refreshIn(session);
      } catch {
        if (session !== currentSession(queryClient)) return;
        for (const [queryKey, list] of prevLists) {
          if (list !== undefined) {
            queryClient.setQueryData(queryKey, list);
          } else {
            void queryClient.invalidateQueries({ queryKey, exact: true });
          }
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

export function useNotificationsList(limit?: number) {
  const query = useQuery(useNotificationsCache().list(limit));

  // Observed so the cache keeps it as long as the list it came with.
  useQuery<string | null>({
    queryKey: queryKeys.notificationsLoadedAt(limit),
    queryFn: skipToken,
  });

  return query;
}

export function useUnreadNotificationCount() {
  return useQuery(useNotificationsCache().unreadCount).data ?? 0;
}
