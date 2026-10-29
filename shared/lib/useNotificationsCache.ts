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
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  getNotificationIdentityKey,
  getNotificationReadRequest,
  isClearedByContentRead,
} from "./notificationIdentity";
import {
  notificationStore,
  selectNotification,
  type NotificationChange,
  type NotificationList,
} from "./notificationStore";
import { queryKeys } from "./queryKeys";
import { currentSession } from "./sessionStores";
import { useStoreState } from "./useStoreState";

const ROOT_KEY = queryKeys.notifications();
const UNREAD_COUNT_KEY = queryKeys.notificationsUnreadCount();

const readWhere =
  (
    marks: (notification: NotificationDto) => boolean,
    readAt: string,
  ): NotificationChange =>
  (notification) =>
    !notification.readAt && marks(notification)
      ? { ...notification, readAt }
      : undefined;

export function notificationsCache(queryClient: QueryClient) {
  const store = notificationStore(queryClient);
  const refreshIn = (session: number) => {
    if (session === currentSession(queryClient))
      void queryClient.invalidateQueries({ queryKey: ROOT_KEY });
  };

  return {
    list: (limit?: number) =>
      queryOptions({
        queryKey: queryKeys.notificationsList(limit),
        queryFn: ({ signal }) =>
          store.loadList({
            signal,
            fetch: async () => {
              const res = await notifsFindAll({
                query: { limit },
                signal,
                throwOnError: true,
              });
              return {
                notifications: res.data,
                loadedAt: res.response.headers.get(NOTIFS_LOADED_AT_HEADER),
              };
            },
          }),
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
      if (notificationsToMark.length === 0) return;
      const session = currentSession(queryClient);
      const keys = new Set(notificationsToMark.map(getNotificationIdentityKey));
      // A record no cached list holds may be stale.
      const listed = new Set(
        queryClient
          .getQueriesData<NotificationList>({
            queryKey: queryKeys.notificationsLists(),
          })
          .flatMap(([, list]) => list?.keys ?? []),
      );
      const loaded = [...keys].map((key) =>
        listed.has(key) ? store.get(key) : undefined,
      );
      const unread = loaded.filter(
        (notification) => notification && !notification.readAt,
      );
      const confirmation = Promise.allSettled(
        notificationsToMark.map((notification) =>
          notifsSetRead({
            ...getNotificationReadRequest(notification),
            throwOnError: true,
          }),
        ),
      ).then((results) => {
        const refused = results.find((result) => result.status === "rejected");
        if (refused) throw refused.reason;
      });
      const readAt = new Date().toISOString();
      store.write({
        session,
        change: readWhere(
          (notification) => keys.has(getNotificationIdentityKey(notification)),
          readAt,
        ),
        confirmation,
      });
      store.writeUnreadCount({
        session,
        update: (count) => Math.max(count - unread.length, 0),
      });
      if (!loaded.some(Boolean)) refreshIn(session);
      try {
        await confirmation;
      } catch (error) {
        refreshIn(session);
        throw error;
      }
    },

    markCachedReadByContent: (
      contentType: UnreadContentType,
      contentIds: number[],
    ) => {
      const ids = new Set(contentIds);
      store.write({
        session: currentSession(queryClient),
        change: readWhere(
          (notification) =>
            isClearedByContentRead({
              notification,
              contentType,
              contentIds: ids,
            }),
          new Date().toISOString(),
        ),
      });
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

      const loadedAt =
        queryClient.getQueryData<NotificationList>(
          queryKeys.notificationsList(limit),
        )?.loadedAt ?? null;
      const readAt = new Date().toISOString();
      const previousCount = queryClient.getQueryData<number>(UNREAD_COUNT_KEY);
      const confirmation = notifsSetReadAll({
        query: { loadedAt: loadedAt ?? undefined },
        throwOnError: true,
      });
      const marked = store.write({
        session,
        change: readWhere(() => true, readAt),
        confirmation,
      });
      store.writeUnreadCount({ session, update: () => 0 });

      try {
        await confirmation;
      } catch {
        const restored = new Set(marked);
        store.write({
          session,
          change: (notification) =>
            restored.has(getNotificationIdentityKey(notification))
              ? { ...notification, readAt: null }
              : undefined,
        });
        if (previousCount !== undefined)
          store.writeUnreadCount({ session, update: () => previousCount });
        refreshIn(session);
        return;
      }
      // Rows that came due after the load stay unread, so the list and
      // count refetch to show them.
      refreshIn(session);
    },
  };
}

export function useNotificationsCache() {
  const queryClient = useQueryClient();
  return useMemo(() => notificationsCache(queryClient), [queryClient]);
}

export function useNotificationsList(limit?: number) {
  const state = useStoreState(notificationStore);
  const select = useCallback(
    (list: NotificationList) =>
      list.keys.map((key) => selectNotification(state, key)),
    [state],
  );
  return useQuery({ ...useNotificationsCache().list(limit), select });
}

export function useUnreadNotificationCount() {
  return useQuery(useNotificationsCache().unreadCount).data ?? 0;
}
