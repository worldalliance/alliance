import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  NotificationDto,
  notifsClear,
  notifsFindAll,
  notifsSetRead,
  notifsSetReadAll,
} from "@alliance/shared/client";
import { useNavigate } from "react-router";
import { useAuth } from "./AuthContext";
import posthog from "posthog-js";

export function getWebAppLocation(webAppLocation: string) {
  return webAppLocation.startsWith("/") ? webAppLocation : "/" + webAppLocation;
}

interface NotificationsContextType {
  notifications: NotificationDto[];
  allNotifications: NotificationDto[];
  unreadCount: number;
  handleNotifClick: (id: number, webAppLocation: string | null) => () => void;
  handleMarkAllAsRead: (e: React.MouseEvent) => void;
  handleClearAll: () => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(
  null
);

export const NotificationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [allNotifications, setAllNotifications] = useState<NotificationDto[]>(
    []
  );
  const [unreadCount, setUnreadCount] = useState(0);

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) return;

    const { data } = await notifsFindAll();
    if (!data) return;

    const sorted = data
      .sort(
        (a, b) =>
          new Date(b.sendTime || b.createdAt).getTime() -
          new Date(a.sendTime || a.createdAt).getTime()
      )
      .filter((n) => new Date(n.sendTime).getTime() <= new Date().getTime());

    setAllNotifications(sorted);
    setNotifications(sorted.filter((n) => !n.cleared));
    setUnreadCount(sorted.filter((n) => !n.read && !n.cleared).length);
  }, [isAuthenticated]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const handleNotifClick = useCallback(
    (id: number, webAppLocation: string | null) => () => {
      notifsSetRead({ path: { id } });

      setAllNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));

      const clickedNotif = allNotifications.find((n) => n.id === id);
      const path = webAppLocation
        ? getWebAppLocation(webAppLocation)
        : window.location.pathname;

      posthog.capture("notification_clicked", {
        notificationId: id,
        category: clickedNotif?.category ?? "unknown category",
        webAppLocation: path,
      });

      if (clickedNotif?.category === "friend_request") {
        navigate(path, { state: { openFriendRequest: true } });
      } else if (clickedNotif?.category === "friend_request_accepted") {
        navigate(path, { state: { openFriends: true } });
      } else {
        navigate(path);
      }
    },
    [navigate, allNotifications]
  );

  const handleMarkAllAsRead = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    notifsSetReadAll();
    setAllNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    posthog.capture("notifications_marked_all_as_read");
  }, []);

  const handleClearAll = useCallback(() => {
    notifsClear();
    setNotifications([]);
    setAllNotifications([]);
    setUnreadCount(0);
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        allNotifications,
        unreadCount,
        handleNotifClick,
        handleMarkAllAsRead,
        handleClearAll,
        refreshNotifications,
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
      "useNotifications must be used within NotificationsProvider"
    );
  }
  return ctx;
};
