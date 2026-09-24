import { AnalyticsEvent } from "@alliance/common/analytics";
import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import {
  NotificationDto,
  notifsFindAll,
  notifsGetUnreadCount,
  notifsSetRead,
  notifsSetReadAll,
  UnreadContentType,
} from "@alliance/shared/client";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { captureEvent } from "./analytics";
import {
  getNotificationIdentityKey,
  getNotificationReadRequest,
  isClearedByContentRead,
} from "./notificationIdentity";

const FIRST_LOAD_LIMIT = 20;

export function getWebAppLocation(webAppLocation: string) {
  return webAppLocation.startsWith("/") ? webAppLocation : "/" + webAppLocation;
}

interface NotificationsContextType {
  notifications: NotificationDto[];
  unreadCount: number;
  handleNotifClick: (
    notification: Pick<
      NotificationDto,
      "id" | "sourceType" | "webAppLocation" | "category"
    >,
  ) => () => void;
  handleMarkAsRead: (
    notification: Pick<NotificationDto, "id" | "sourceType">,
  ) => () => void;
  handleMarkAllAsRead: (e: React.MouseEvent) => void;
  refreshNotifications: (options?: { limit?: number }) => Promise<void>;
  /** Loads the whole list and keeps later refreshes whole until the returned cleanup runs. */
  showWholeList: () => () => void;
  applyNotificationsReadByContent: (
    contentType: UnreadContentType,
    contentIds: number[],
  ) => void;
}

const NotificationsContext = createContext<NotificationsContextType | null>(
  null,
);

export const NotificationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const loadedAtRef = useRef<string | null>(null);
  const lastLimitRef = useRef<number | undefined>(FIRST_LOAD_LIMIT);
  const wholeListsStartedRef = useRef(0);
  const wholeListsInFlightRef = useRef(0);
  const lastWholeListShownRef = useRef(0);
  const wholeListViewsRef = useRef(0);

  const navigate = useNavigate();

  const loadNotifications = useCallback(
    async (options?: { limit?: number }) => {
      const limit = options?.limit;
      if (limit !== undefined) {
        const wholeListShownBefore = lastWholeListShownRef.current;
        const [{ data, response }, { data: unreadCountData }] =
          await Promise.all([
            notifsFindAll({ query: { limit } }),
            notifsGetUnreadCount(),
          ]);
        if (lastWholeListShownRef.current !== wholeListShownBefore) return;
        if (data) {
          setNotifications(data);
          lastLimitRef.current = limit;
          loadedAtRef.current = response.headers.get(NOTIFS_LOADED_AT_HEADER);
        }
        if (unreadCountData !== undefined) {
          setUnreadCount(unreadCountData.unreadCount);
        }
      } else {
        const wholeList = ++wholeListsStartedRef.current;
        wholeListsInFlightRef.current++;
        const { data, response } = await notifsFindAll().finally(() => {
          wholeListsInFlightRef.current--;
        });
        if (!data || wholeList < lastWholeListShownRef.current) return;
        lastWholeListShownRef.current = wholeList;
        setNotifications(data);
        lastLimitRef.current = limit;
        loadedAtRef.current = response.headers.get(NOTIFS_LOADED_AT_HEADER);
        setUnreadCount(data.filter((n) => !n.readAt).length);
      }
    },
    [],
  );

  const refreshNotifications = useCallback(
    (options?: { limit?: number }) =>
      loadNotifications({
        limit:
          wholeListViewsRef.current > 0 ||
          // A whole list still in flight may predate the caller's write.
          wholeListsInFlightRef.current > 0
            ? undefined
            : options?.limit,
      }),
    [loadNotifications],
  );

  const showWholeList = useCallback(() => {
    wholeListViewsRef.current++;
    void loadNotifications();
    return () => {
      wholeListViewsRef.current--;
    };
  }, [loadNotifications]);

  useEffect(() => {
    loadNotifications({ limit: FIRST_LOAD_LIMIT });
  }, [loadNotifications]);

  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  const markNotificationRead = useCallback(
    (notification: Pick<NotificationDto, "id" | "sourceType">) => {
      notifsSetRead(getNotificationReadRequest(notification));
      setNotifications((prev) => {
        const key = getNotificationIdentityKey(notification);
        const readAt = new Date().toISOString();
        let wasUnread = false;
        const next = prev.map((n) => {
          if (getNotificationIdentityKey(n) === key) {
            if (!n.readAt) wasUnread = true;
            return { ...n, readAt } satisfies NotificationDto;
          }
          return n;
        });
        if (wasUnread) {
          setUnreadCount((c) => Math.max(c - 1, 0));
        }
        return next;
      });
    },
    [],
  );

  const handleNotifClick = useCallback(
    (
      notification: Pick<
        NotificationDto,
        "id" | "sourceType" | "webAppLocation" | "category"
      >,
    ) =>
      () => {
        const clickedNotif = notificationsRef.current.find(
          (n) =>
            getNotificationIdentityKey(n) ===
            getNotificationIdentityKey(notification),
        );
        const path = notification.webAppLocation
          ? getWebAppLocation(notification.webAppLocation)
          : window.location.pathname;

        captureEvent(AnalyticsEvent.NotificationClicked, {
          notificationId: notification.id,
          notificationSourceType:
            clickedNotif?.sourceType ?? notification.sourceType,
          category: clickedNotif?.category ?? notification.category,
          webAppLocation: path,
        });

        if (clickedNotif?.category === "friend_request") {
          navigate(path, { state: { openFriendRequest: true } });
        } else if (clickedNotif?.category === "friend_request_accepted") {
          navigate(path, { state: { openFriends: true } });
        } else {
          navigate(path);
        }

        markNotificationRead(notification);

        captureEvent(AnalyticsEvent.NotificationReadViaClick, {
          notificationId: notification.id,
          notificationSourceType:
            clickedNotif?.sourceType ?? notification.sourceType,
        });
      },
    [navigate, markNotificationRead],
  );

  const handleMarkAsRead = useCallback(
    (notification: Pick<NotificationDto, "id" | "sourceType">) => () => {
      captureEvent(AnalyticsEvent.NotificationMarkedRead, {
        notificationId: notification.id,
        notificationSourceType: notification.sourceType,
      });
      markNotificationRead(notification);
    },
    [markNotificationRead],
  );

  const handleMarkAllAsRead = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      notifsSetReadAll({
        query: { loadedAt: loadedAtRef.current ?? undefined },
      }).then(() => refreshNotifications({ limit: lastLimitRef.current }));
      const readAt = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt }) satisfies NotificationDto),
      );
      setUnreadCount(0);

      captureEvent(AnalyticsEvent.NotificationsMarkedAllAsRead);
    },
    [refreshNotifications],
  );

  const applyNotificationsReadByContent = useCallback(
    (contentType: UnreadContentType, contentIds: number[]) => {
      if (contentIds.length === 0) {
        return;
      }

      const ids = new Set(contentIds);
      const readAt = new Date().toISOString();

      setNotifications((prev) => {
        let markedCount = 0;
        const next = prev.map((notification) => {
          if (
            !isClearedByContentRead({
              notification,
              contentType,
              contentIds: ids,
            })
          ) {
            return notification;
          }

          markedCount++;
          return { ...notification, readAt } satisfies NotificationDto;
        });

        if (markedCount > 0) {
          setUnreadCount((c) => Math.max(c - markedCount, 0));
        }

        return markedCount > 0 ? next : prev;
      });
    },
    [],
  );

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        handleNotifClick,
        handleMarkAsRead,
        handleMarkAllAsRead,
        refreshNotifications,
        showWholeList,
        applyNotificationsReadByContent,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within NotificationsProvider",
    );
  }
  return ctx;
};

export const useOptionalNotifications = (): NotificationsContextType | null =>
  useContext(NotificationsContext);
