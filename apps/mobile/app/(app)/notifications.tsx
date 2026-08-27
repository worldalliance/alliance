import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  NotificationDto,
  notifsFindAll,
  notifsSetRead,
  notifsSetReadAll,
} from "@alliance/shared/client";
import { captureEvent } from "@alliance/shared/lib/analytics";
import {
  buildNotificationRenderItems,
  getNotificationTime,
  LikesBucket,
  NotificationRenderItem,
} from "@alliance/shared/lib/notificationBucketing";
import {
  getNotificationIdentityKey,
  getNotificationReadRequest,
} from "@alliance/shared/lib/notificationIdentity";
import { LegendList } from "@legendapp/list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RelativePathString, router } from "expo-router";
import { Ellipsis } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  TouchableOpacity,
  View,
} from "react-native";
import MobileLikesGroup from "../../components/LikesGroup";
import ProfileImage from "../../components/ProfileImage";
import SwipeableNotification from "../../components/SwipeableNotification";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";

const normalizeLocation = (location: string | null) => {
  if (!location) return null;
  const normalized = location.startsWith("/") ? location : `/${location}`;
  const [path, query] = normalized.split("?");
  const segments = path.split("/").filter(Boolean);

  if (segments[0] === "tasks") {
    return "/";
  }

  return query ? `${path}?${query}` : path;
};

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const { user } = useAuth();

  const [overflowOpen, setOverflowOpen] = useState(false);

  const {
    data: response,
    isPending,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      notifsFindAll().then((res) => {
        return res.data;
      }),
  });

  const refreshNotifications = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({
      queryKey: ["notifications", "unreadCount"],
    });
  }, [refetch, queryClient]);

  const notifications = useMemo(() => {
    if (!response) return [];
    return response
      .sort(
        (a, b) =>
          getNotificationTime(b).getTime() - getNotificationTime(a).getTime(),
      )
      .filter((notif) => getNotificationTime(notif).getTime() <= Date.now());
  }, [response]);

  const unreadTotal = useMemo(() => {
    return response?.filter((n) => !n.readAt).length ?? 0;
  }, [response]);

  const renderItems = useMemo(
    () => buildNotificationRenderItems(notifications),
    [notifications],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (unreadTotal === 0) return;

    await queryClient.cancelQueries({ queryKey: ["notifications"] });
    await queryClient.cancelQueries({
      queryKey: ["notifications", "unreadCount"],
    });

    // Backend marks everything read; we also update cached list for snappy UX.
    const prevNotifications = queryClient.getQueryData<NotificationDto[]>([
      "notifications",
    ]);
    const prevUnreadCount = queryClient.getQueryData<number>([
      "notifications",
      "unreadCount",
    ]);

    const readAt = new Date().toISOString();
    queryClient.setQueryData(
      ["notifications"],
      (oldData: NotificationDto[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map((notification) => ({
          ...notification,
          readAt,
        }));
      },
    );
    queryClient.setQueryData<number>(["notifications", "unreadCount"], 0);

    try {
      const res = await notifsSetReadAll();
      if (res && typeof res === "object" && "error" in res && res.error) {
        throw (res as { error: unknown }).error;
      }
    } catch {
      if (prevNotifications !== undefined) {
        queryClient.setQueryData(["notifications"], prevNotifications);
      } else {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }

      if (prevUnreadCount !== undefined) {
        queryClient.setQueryData(
          ["notifications", "unreadCount"],
          prevUnreadCount,
        );
      } else {
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unreadCount"],
        });
      }
    }

    captureEvent(AnalyticsEvent.NotificationsMarkedAllAsRead);
  }, [queryClient, unreadTotal]);

  const markAllOverflow = (() => {
    if (unreadTotal === 0) return null;

    return (
      <View className="relative">
        <TouchableOpacity
          onPress={() => setOverflowOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open notification actions"
          className="p-2"
        >
          <Ellipsis size={18} color="#0D1B2A" strokeWidth={2} />
        </TouchableOpacity>

        <Modal
          visible={overflowOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setOverflowOpen(false)}
        >
          <Pressable
            className="flex-1 bg-black/20"
            onPress={() => setOverflowOpen(false)}
          >
            <View className="mx-4 mt-28 bg-white border border-zinc-200 rounded overflow-hidden">
              <TouchableOpacity
                onPress={() => {
                  setOverflowOpen(false);
                  void handleMarkAllAsRead();
                }}
                className="px-4 py-3 flex-row justify-between items-center"
                accessibilityRole="button"
                accessibilityLabel="Mark all notifications as read"
                testID="vr-notifications-mark-all-read"
              >
                <Text className="text-sm text-zinc-900">Mark all as read</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  })();

  const markNotificationsRead = useCallback(
    (notificationsToMark: Pick<NotificationDto, "id" | "sourceType">[]) => {
      if (notificationsToMark.length === 0) {
        return;
      }

      const keys = new Set(
        notificationsToMark.map((notification) =>
          getNotificationIdentityKey(notification),
        ),
      );
      const readAt = new Date().toISOString();
      queryClient.setQueryData(
        ["notifications"],
        (oldData: typeof response) => {
          if (!oldData) return oldData;
          return oldData.map((notification) =>
            keys.has(getNotificationIdentityKey(notification))
              ? { ...notification, readAt }
              : notification,
          );
        },
      );
      queryClient.setQueryData<number>(
        ["notifications", "unreadCount"],
        (prev) =>
          Math.max(
            (prev ??
              notifications.filter((notification) => !notification.readAt)
                .length) - notificationsToMark.length,
            0,
          ),
      );
    },
    [notifications, queryClient],
  );

  const handleMarkAsRead = useCallback(
    (notification: NotificationDto) => {
      notifsSetRead(getNotificationReadRequest(notification));
      markNotificationsRead([notification]);
      captureEvent(AnalyticsEvent.NotificationMarkedRead, {
        notificationId: notification.id,
        notificationSourceType: notification.sourceType,
      });
    },
    [markNotificationsRead],
  );

  const handleMarkBucketAsRead = useCallback(
    (bucket: LikesBucket) => {
      const unreadLikes = bucket.likes.filter(
        (notification) => !notification.readAt,
      );
      if (unreadLikes.length === 0) {
        return;
      }

      unreadLikes.forEach((notification) => {
        notifsSetRead(getNotificationReadRequest(notification));
      });
      markNotificationsRead(unreadLikes);
    },
    [markNotificationsRead],
  );

  const handleNotificationPress = useCallback(
    (notification: NotificationDto) => {
      if (!notification.readAt) {
        notifsSetRead(getNotificationReadRequest(notification));
        markNotificationsRead([notification]);
      }

      const destination = normalizeLocation(
        notification.mobileAppLocation ?? notification.webAppLocation ?? null,
      );

      captureEvent(AnalyticsEvent.NotificationClicked, {
        notificationId: notification.id,
        notificationSourceType: notification.sourceType,
        category: notification.category ?? "unknown category",
        webAppLocation: destination ?? "",
      });

      if (destination) {
        router.push(destination as RelativePathString);
      }
    },
    [markNotificationsRead],
  );

  const renderNotification = useCallback(
    ({ item }: { item: NotificationRenderItem }) => {
      if (item.type === "likes-group") {
        return (
          <MobileLikesGroup
            key={item.key}
            bucket={item.bucket}
            onMarkBucketRead={handleMarkBucketAsRead}
            onMarkRead={handleMarkAsRead}
            onPressNotification={handleNotificationPress}
          />
        );
      }

      return (
        <SwipeableNotification
          key={item.key}
          notification={item.notification}
          onPress={() => handleNotificationPress(item.notification)}
          onMarkRead={() => handleMarkAsRead(item.notification)}
        />
      );
    },
    [handleMarkAsRead, handleMarkBucketAsRead, handleNotificationPress],
  );

  return isPending ? (
    <View className="flex-1">
      <SimplePageTitle title="Notifications">
        <TouchableOpacity
          onPress={() => router.push("/profile")}
          className="px-2"
          accessibilityLabel="View profile"
        >
          <ProfileImage pfp={user?.profilePicture ?? null} size="medium" />
        </TouchableOpacity>
      </SimplePageTitle>
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    </View>
  ) : error ? (
    <View className="flex-1">
      <SimplePageTitle title="Notifications">
        <View className="flex-row items-center gap-x-2">
          {markAllOverflow}
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            className="px-2"
            accessibilityLabel="View profile"
          >
            <ProfileImage pfp={user?.profilePicture ?? null} size="medium" />
          </TouchableOpacity>
        </View>
      </SimplePageTitle>
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-center text-red-500">{error.message}</Text>
      </View>
    </View>
  ) : renderItems.length === 0 ? (
    <View className="flex-1">
      <SimplePageTitle title="Notifications">
        <View className="flex-row items-center gap-x-2">
          {markAllOverflow}
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            className="px-2"
            accessibilityLabel="View profile"
          >
            <ProfileImage pfp={user?.profilePicture ?? null} size="medium" />
          </TouchableOpacity>
        </View>
      </SimplePageTitle>
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-zinc-500">You&apos;re all caught up.</Text>
      </View>
    </View>
  ) : (
    <View className="flex-1 bg-white" testID="vr-notifications-ready">
      <SimplePageTitle title="Notifications">
        <View className="flex-row items-center gap-x-2">
          {markAllOverflow}
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            className="px-2"
            accessibilityLabel="View profile"
          >
            <ProfileImage pfp={user?.profilePicture ?? null} size="medium" />
          </TouchableOpacity>
        </View>
      </SimplePageTitle>
      <LegendList
        data={renderItems}
        keyExtractor={(item) => item.key}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refreshNotifications}
          />
        }
        recycleItems
        renderItem={({ item }) => (
          <View key={item.key} className="border-b border-zinc-200">
            {renderNotification({ item })}
          </View>
        )}
        contentContainerStyle={{
          paddingBottom: 40,
          backgroundColor: "white",
        }}
      />
    </View>
  );
}
