import { AnalyticsEvent } from "@alliance/common/analytics";
import { NotificationDto, notifsSetRead } from "@alliance/shared/client";
import { captureEvent } from "@alliance/shared/lib/analytics";
import {
  buildNotificationRenderItems,
  LikesBucket,
  NotificationRenderItem,
} from "@alliance/shared/lib/notificationBucketing";
import { getNotificationReadRequest } from "@alliance/shared/lib/notificationIdentity";
import { LegendList } from "@legendapp/list";
import { router } from "expo-router";
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
import { notificationRoute } from "../../lib/notificationRoute";
import { colors } from "../../lib/style/colors";
import {
  useNotificationsCache,
  useNotificationsList,
} from "../../lib/useNotificationsCache";

export default function NotificationsScreen() {
  const { user } = useAuth();

  const [overflowOpen, setOverflowOpen] = useState(false);

  const {
    data: response,
    isPending,
    isRefetching,
    error,
  } = useNotificationsList();
  const {
    markAllRead,
    markCachedRead: markNotificationsRead,
    refresh: refreshNotifications,
  } = useNotificationsCache();

  const notifications = useMemo(() => response ?? [], [response]);

  const unreadTotal = useMemo(() => {
    return response?.filter((n) => !n.readAt).length ?? 0;
  }, [response]);

  const renderItems = useMemo(
    () => buildNotificationRenderItems(notifications),
    [notifications],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (unreadTotal === 0) return;

    await markAllRead();

    captureEvent(AnalyticsEvent.NotificationsMarkedAllAsRead);
  }, [markAllRead, unreadTotal]);

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

      const destination = notificationRoute(
        notification.mobileAppLocation ?? notification.webAppLocation ?? null,
      );

      captureEvent(AnalyticsEvent.NotificationClicked, {
        notificationId: notification.id,
        notificationSourceType: notification.sourceType,
        category: notification.category ?? "unknown category",
        webAppLocation: destination ?? "",
      });

      if (destination) {
        router.push(destination);
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
