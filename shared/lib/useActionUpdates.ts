import { queryOptions, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  actionUpdatesAllUpdates,
  actionUpdatesRecentUpdates,
  type ActionUpdateDto,
  type NotificationDto,
} from "../client";
import { queryKeys } from "./queryKeys";
import {
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
 * `notificationsLimit` picks which cached notifications list to read, so pass
 * the one the app already loads.
 */
export function useActionUpdateNewState(
  updates: readonly ActionUpdateDto[] | undefined,
  notificationsLimit?: number,
) {
  const { data: notifications } = useNotificationsList(notificationsLimit);
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
export function useHomeActionUpdates(notificationsLimit?: number) {
  const query = useRecentActionUpdates(HOME_UPDATES_LIMIT);
  return {
    query,
    ...useActionUpdateNewState(query.data, notificationsLimit),
  };
}
