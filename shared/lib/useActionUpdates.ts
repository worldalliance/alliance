import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  actionUpdatesAllUpdates,
  actionUpdatesRecentUpdates,
  type ActionUpdateDto,
  type NotificationDto,
} from "../client";
import { queryKeys } from "./queryKeys";
import {
  NOTIFICATIONS_PREVIEW_LIMIT,
  useNotificationsCache,
  useNotificationsList,
} from "./useNotificationsCache";

export const HOME_UPDATES_LIMIT = 5;

export const recentActionUpdatesQuery = (limit: number) =>
  queryOptions({
    queryKey: queryKeys.actionUpdatesRecent(limit),
    queryFn: () =>
      actionUpdatesRecentUpdates({ query: { limit }, throwOnError: true }).then(
        (r) => r.data,
      ),
  });

export function useRecentActionUpdates(limit: number) {
  return useQuery(recentActionUpdatesQuery(limit));
}

export function useAllActionUpdates() {
  return useQuery({
    queryKey: queryKeys.actionUpdatesAll(),
    queryFn: () =>
      actionUpdatesAllUpdates({ throwOnError: true }).then((r) => r.data),
  });
}

export function actionUpdateNotificationsById(
  notifications: readonly NotificationDto[],
): Map<number, NotificationDto> {
  const byId = new Map<number, NotificationDto>();
  for (const notification of notifications) {
    if (
      notification.contentType === "action_update" &&
      notification.contentId !== undefined
    ) {
      byId.set(notification.contentId, notification);
    }
  }
  return byId;
}

/** The update with the latest date, which the cards always tag "New". */
export function newestUpdateId(
  updates: readonly Pick<ActionUpdateDto, "id" | "date">[],
): number | undefined {
  let newest: Pick<ActionUpdateDto, "id" | "date"> | undefined;
  for (const update of updates) {
    if (!newest || new Date(update.date) > new Date(newest.date)) {
      newest = update;
    }
  }
  return newest?.id;
}

/**
 * Whether each update's card is tagged "New": the newest update always is,
 * and so is any update whose notification the member hasn't read.
 * `markOpened` marks an opened update's notification read.
 * Reads only the newest `NOTIFICATIONS_PREVIEW_LIMIT` notifications, the list
 * web's bell already loads, so an older unread one doesn't tag its update.
 */
export function useActionUpdateNewState(
  updates: readonly ActionUpdateDto[] | undefined,
) {
  const { data: notifications } = useNotificationsList(
    NOTIFICATIONS_PREVIEW_LIMIT,
  );
  const { markRead } = useNotificationsCache();

  const notificationsById = useMemo(
    () => actionUpdateNotificationsById(notifications ?? []),
    [notifications],
  );
  const newestId = useMemo(() => newestUpdateId(updates ?? []), [updates]);

  const isNew = useCallback(
    (updateId: number) => {
      if (updateId === newestId) return true;
      const notification = notificationsById.get(updateId);
      return notification !== undefined && !notification.readAt;
    },
    [notificationsById, newestId],
  );

  const markOpened = useCallback(
    (updateId: number) => {
      const notification = notificationsById.get(updateId);
      if (!notification || notification.readAt) return;
      void markRead([notification]).catch((error) => {
        console.error("failed to mark update notification as read", error);
      });
    },
    [notificationsById, markRead],
  );

  return { isNew, markOpened };
}

/** The home page's recent updates, with which of them are new. */
export function useHomeActionUpdates() {
  const query = useRecentActionUpdates(HOME_UPDATES_LIMIT);
  return { query, ...useActionUpdateNewState(query.data) };
}

export function useInvalidateHomeActionUpdates(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionUpdatesRecent(HOME_UPDATES_LIMIT),
      }),
    [queryClient],
  );
}
