import {
  NotificationDto,
  NotificationSourceType,
  notifsSetRead,
  pushMarkOpened,
} from "@alliance/shared/client";
import {
  getNotificationIdentityKey,
  getNotificationReadRequest,
} from "@alliance/shared/lib/notificationIdentity";
import { QueryClient } from "@tanstack/react-query";
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
  type EventSubscription,
  type NotificationResponse,
} from "expo-notifications";
import { RelativePathString, router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { isVisualTestMode } from "../lib/visualTest";

type PushData = {
  cid?: number;
  screen?: string;
  notificationId?: number;
  notificationSourceType?: NotificationSourceType;
};

type PendingNotificationAction = {
  cid?: number;
  notificationId?: number;
  notificationSourceType?: NotificationSourceType;
  screen?: string;
};

function getPushRoute(screen: string | undefined): RelativePathString | null {
  if (typeof screen !== "string" || screen.length === 0) {
    return null;
  }

  const normalized = screen.startsWith("/") ? screen : `/${screen}`;
  return normalized as RelativePathString;
}

function setNotificationReadOptimistically(
  notificationToMark: Pick<NotificationDto, "id" | "sourceType">,
  queryClient: QueryClient,
) {
  const existingData = queryClient.getQueryData<NotificationDto[]>([
    "notifications",
  ]);

  if (!existingData) {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({
      queryKey: ["notifications", "unreadCount"],
    });
    return;
  }

  const readAt = new Date().toISOString();
  let foundNotification = false;
  let markedUnreadCount = 0;
  const nextData = existingData.map((notification) => {
    if (
      getNotificationIdentityKey(notification) !==
      getNotificationIdentityKey(notificationToMark)
    ) {
      return notification;
    }

    foundNotification = true;
    if (!notification.readAt) {
      markedUnreadCount += 1;
    }
    return { ...notification, readAt };
  });

  if (!foundNotification) {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({
      queryKey: ["notifications", "unreadCount"],
    });
    return;
  }

  queryClient.setQueryData<NotificationDto[]>(["notifications"], nextData);
  queryClient.setQueryData<number>(["notifications", "unreadCount"], (prev) => {
    if (prev === undefined) {
      return nextData.filter((notification) => !notification.readAt).length;
    }

    return Math.max(prev - markedUnreadCount, 0);
  });
}

export default function PushNotificationResponseHandler({
  queryClient,
}: {
  queryClient: QueryClient;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const pendingNotificationActionRef = useRef<PendingNotificationAction | null>(
    null,
  );
  const authStateRef = useRef({ isAuthenticated, isLoading });
  const lastHandledResponseIdentifierRef = useRef<string | null>(null);
  const responseSub = useRef<EventSubscription | null>(null);

  const markNotificationReadFromTap = useCallback(
    (notification: Pick<NotificationDto, "id" | "sourceType">) => {
      setNotificationReadOptimistically(notification, queryClient);

      void notifsSetRead(getNotificationReadRequest(notification)).catch(
        (error) => {
          console.error(
            "failed to mark notification as read from push tap",
            error,
          );
        },
      );
    },
    [queryClient],
  );

  const handlePendingNotificationAction = useCallback(
    (pendingAction: PendingNotificationAction) => {
      if (pendingAction.cid) {
        void pushMarkOpened({ body: { cid: pendingAction.cid } }).catch(
          (error) => {
            console.error("failed to mark push as opened", error);
          },
        );
      }

      if (
        pendingAction.notificationId &&
        pendingAction.notificationSourceType
      ) {
        markNotificationReadFromTap({
          id: pendingAction.notificationId,
          sourceType: pendingAction.notificationSourceType,
        });
      }

      const route = getPushRoute(pendingAction.screen);
      if (route) {
        router.push(route);
      }
    },
    [markNotificationReadFromTap],
  );

  const handleNotificationResponse = useCallback(
    (response: NotificationResponse | null) => {
      if (!response) {
        return;
      }

      const responseIdentifier = response.notification.request.identifier;
      if (lastHandledResponseIdentifierRef.current === responseIdentifier) {
        return;
      }
      lastHandledResponseIdentifierRef.current = responseIdentifier;

      const data = response.notification.request.content.data as
        | PushData
        | undefined;
      const pendingAction: PendingNotificationAction = {
        cid: typeof data?.cid === "number" ? data.cid : undefined,
        notificationId:
          typeof data?.notificationId === "number"
            ? data.notificationId
            : undefined,
        notificationSourceType: data?.notificationSourceType,
        screen: data?.screen,
      };

      const authState = authStateRef.current;
      if (authState.isLoading || !authState.isAuthenticated) {
        // Last tap wins while auth is unavailable.
        pendingNotificationActionRef.current = pendingAction;
        return;
      }

      handlePendingNotificationAction(pendingAction);
    },
    [handlePendingNotificationAction],
  );

  useEffect(() => {
    authStateRef.current = { isAuthenticated, isLoading };
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }

    const pendingAction = pendingNotificationActionRef.current;
    if (!pendingAction) {
      return;
    }

    pendingNotificationActionRef.current = null;
    handlePendingNotificationAction(pendingAction);
  }, [handlePendingNotificationAction, isAuthenticated, isLoading]);

  useEffect(() => {
    if (isVisualTestMode || Platform.OS === "web") {
      return;
    }

    handleNotificationResponse(getLastNotificationResponse());

    // Only tapped notification responses should mark reads, not delivered pushes.
    responseSub.current = addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    return () => {
      responseSub.current?.remove();
    };
  }, [handleNotificationResponse]);

  return null;
}
