import { AnalyticsEvent } from "@alliance/common/analytics";
import type { NotificationDto } from "@alliance/shared/client";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { useNotificationsCache } from "@alliance/shared/lib/useNotificationsCache";
import type React from "react";
import { useCallback } from "react";
import { useNavigate } from "react-router";

export const NOTIFICATIONS_PREVIEW_LIMIT = 20;

function getWebAppLocation(webAppLocation: string) {
  return webAppLocation.startsWith("/") ? webAppLocation : "/" + webAppLocation;
}

export function useNotificationActions() {
  const navigate = useNavigate();
  const { markRead, markAllRead } = useNotificationsCache();

  const markNotificationRead = useCallback(
    (notification: Pick<NotificationDto, "id" | "sourceType">) => {
      void markRead([notification]).catch((error) => {
        console.error("failed to mark notification as read", error);
      });
    },
    [markRead],
  );

  const handleNotifClick = useCallback(
    (
      notification: Pick<
        NotificationDto,
        "id" | "sourceType" | "webAppLocation" | "category"
      >,
    ) =>
      () => {
        const path = notification.webAppLocation
          ? getWebAppLocation(notification.webAppLocation)
          : window.location.pathname;

        captureEvent(AnalyticsEvent.NotificationClicked, {
          notificationId: notification.id,
          notificationSourceType: notification.sourceType,
          category: notification.category,
          webAppLocation: path,
        });

        if (notification.category === "friend_request") {
          navigate(path, { state: { openFriendRequest: true } });
        } else if (notification.category === "friend_request_accepted") {
          navigate(path, { state: { openFriends: true } });
        } else {
          navigate(path);
        }

        markNotificationRead(notification);

        captureEvent(AnalyticsEvent.NotificationReadViaClick, {
          notificationId: notification.id,
          notificationSourceType: notification.sourceType,
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
    (limit?: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      void markAllRead(limit);
      captureEvent(AnalyticsEvent.NotificationsMarkedAllAsRead);
    },
    [markAllRead],
  );

  return { handleNotifClick, handleMarkAsRead, handleMarkAllAsRead };
}
