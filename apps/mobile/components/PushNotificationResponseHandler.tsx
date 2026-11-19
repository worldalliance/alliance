import { ExceptionEvent } from "@alliance/common/analytics";
// eslint-disable-next-line api-client/named-hooks-only -- one-off request whose result no query cache holds
import {
  NotificationDto,
  NotificationSourceType,
  pushMarkOpened,
} from "@alliance/shared/client";
import { captureException } from "@alliance/shared/lib/analytics";
import { useNotificationsCache } from "@alliance/shared/lib/useNotificationsCache";
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
  type EventSubscription,
  type NotificationResponse,
} from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { notificationRoute } from "../lib/notificationRoute";
import { handledPushTaps, pushTapRunner } from "../lib/pushTaps";
import { isVisualTestMode } from "../lib/visualTest";

type PushData = {
  cid?: number;
  screen?: string;
  notificationId?: number;
  notificationSourceType?: NotificationSourceType;
};

type PendingNotificationAction = {
  tapId: string;
  cid?: number;
  notificationId?: number;
  notificationSourceType?: NotificationSourceType;
  screen?: string;
};

export default function PushNotificationResponseHandler() {
  const { isAuthenticated, isLoading } = useAuth();
  const { markRead } = useNotificationsCache();
  const authStateRef = useRef({ isAuthenticated, isLoading });
  const [taps] = useState(() =>
    pushTapRunner<PendingNotificationAction>({
      taps: handledPushTaps((error) =>
        captureException(ExceptionEvent.HandledPushTapsFailed, error),
      ),
      canRun: () =>
        !authStateRef.current.isLoading && authStateRef.current.isAuthenticated,
    }),
  );
  const responseSub = useRef<EventSubscription | null>(null);

  const markNotificationReadFromTap = useCallback(
    (notification: Pick<NotificationDto, "id" | "sourceType">) => {
      void markRead([notification]).catch((error) => {
        console.error(
          "failed to mark notification as read from push tap",
          error,
        );
      });
    },
    [markRead],
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

      const route = notificationRoute(pendingAction.screen);
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
      const data = response.notification.request.content.data as
        | PushData
        | undefined;
      void taps.arrive(
        {
          tapId: response.notification.request.identifier,
          cid: typeof data?.cid === "number" ? data.cid : undefined,
          notificationId:
            typeof data?.notificationId === "number"
              ? data.notificationId
              : undefined,
          notificationSourceType: data?.notificationSourceType,
          screen: data?.screen,
        },
        handlePendingNotificationAction,
      );
    },
    [handlePendingNotificationAction, taps],
  );

  useEffect(() => {
    authStateRef.current = { isAuthenticated, isLoading };
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    taps.resume(handlePendingNotificationAction);
  }, [handlePendingNotificationAction, isAuthenticated, isLoading, taps]);

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
