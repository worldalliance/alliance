import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  View,
} from "react-native";
import { router, RelativePathString } from "expo-router";
import {
  NotificationDto,
  notifsFindAll,
  notifsSetRead,
  notifsSetReadAll,
} from "@alliance/shared/client";
import { usePostHog } from "posthog-react-native";
import Button, {
  ButtonColor,
  ButtonSize,
} from "../../components/system/Button";
import Text from "../../components/system/Text";
import GreenHeader from "../../components/GreenHeader";
import { formatTime } from "@alliance/shared/lib/utils";
import ProfileImage from "../../components/ProfileImage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LegendList } from "@legendapp/list";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Check } from "lucide-react-native";

const SWIPE_THRESHOLD = -80;

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

const getNotifTime = (notification: NotificationDto) => {
  return new Date(notification.sendTime || notification.createdAt);
};

interface SwipeableNotificationProps {
  notification: NotificationDto;
  onPress: () => void;
  onMarkRead: () => void;
}

function SwipeableNotification({
  notification,
  onPress,
  onMarkRead,
}: SwipeableNotificationProps) {
  const translateX = useSharedValue(0);
  const isUnread = !notification.readAt;

  const displayUsers = notification.associatedUsers.slice(0, 3);
  const remainingUsers =
    notification.associatedUsers.length - displayUsers.length;

  const panGesture = Gesture.Pan()
    .enabled(isUnread)
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      // Only allow swiping left (negative values)
      translateX.value = Math.min(0, event.translationX);
    })
    .onEnd(() => {
      if (translateX.value < SWIPE_THRESHOLD) {
        runOnJS(onMarkRead)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionStyle = useAnimatedStyle(() => {
    const width = interpolate(
      translateX.value,
      [SWIPE_THRESHOLD, 0],
      [-SWIPE_THRESHOLD, 0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      translateX.value,
      [SWIPE_THRESHOLD, -20, 0],
      [1, 0.5, 0],
      Extrapolation.CLAMP
    );
    return {
      width,
      opacity,
    };
  });

  return (
    <View className="overflow-hidden border-t mx-px border-zinc-300">
      {/* Background action area */}
      <Animated.View
        style={[actionStyle]}
        className="absolute right-0 top-0 bottom-0 bg-green items-center justify-center"
      >
        <View className="flex-row items-center gap-x-1 px-3">
          <Check size={16} color="white" />
          <Text className="text-white text-sm font-medium text-nowrap whitespace-nowrap">
            Read
          </Text>
        </View>
      </Animated.View>

      {/* Swipeable content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={contentStyle}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onPress}
            className={`px-6 py-4 ${
              notification.readAt ? "bg-white" : "bg-red-50"
            }`}
          >
            <View className="flex-1">
              <View className="flex-row items-center flex-wrap gap-x-1">
                {displayUsers.map((user) => (
                  <ProfileImage
                    key={user.id}
                    pfp={user.profilePicture}
                    size="small"
                  />
                ))}
                {remainingUsers > 0 && (
                  <Text className="text-xs text-zinc-500 mr-1">
                    +{remainingUsers}
                  </Text>
                )}
                <Text
                  className="text-base text-zinc-900 flex-1"
                  numberOfLines={2}
                >
                  {notification.category === "action_update" && (
                    <Text className="font-semibold">Action update: </Text>
                  )}
                  {notification.message}
                </Text>
              </View>
              <Text className="text-xs text-zinc-500 mt-1">
                {formatTime(getNotifTime(notification), {
                  addSuffix: true,
                })}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default function NotificationsScreen() {
  const posthog = usePostHog();
  const queryClient = useQueryClient();

  const {
    data: response,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notifsFindAll(),
  });

  const notifications = useMemo(() => {
    if (!response?.data) return [];
    return response.data
      .sort((a, b) => getNotifTime(b).getTime() - getNotifTime(a).getTime())
      .filter((notif) => getNotifTime(notif).getTime() <= Date.now());
  }, [response]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

  const handleMarkAsRead = useCallback(
    (notificationId: number) => {
      notifsSetRead({ path: { id: notificationId } });
      const readAt = new Date().toISOString();
      queryClient.setQueryData(
        ["notifications"],
        (oldData: typeof response) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((n) =>
              n.id === notificationId ? { ...n, readAt } : n
            ),
          };
        }
      );
      posthog?.capture("notification_swiped_read", { notificationId });
    },
    [posthog, queryClient]
  );

  const handleMarkAllAsRead = useCallback(() => {
    notifsSetReadAll();
    const readAt = new Date().toISOString();
    queryClient.setQueryData(["notifications"], (oldData: typeof response) => {
      if (!oldData?.data) return oldData;
      return {
        ...oldData,
        data: oldData.data.map((n) => ({ ...n, readAt })),
      };
    });
    posthog?.capture("notifications_marked_all_as_read");
  }, [posthog, queryClient]);

  const handleNotificationPress = useCallback(
    (notification: NotificationDto) => {
      if (!notification.readAt) {
        notifsSetRead({ path: { id: notification.id } });
        const readAt = new Date().toISOString();
        queryClient.setQueryData(
          ["notifications"],
          (oldData: typeof response) => {
            if (!oldData?.data) return oldData;
            return {
              ...oldData,
              data: oldData.data.map((n) =>
                n.id === notification.id ? { ...n, readAt } : n
              ),
            };
          }
        );
      }

      const destination = normalizeLocation(
        notification.mobileAppLocation ?? notification.webAppLocation
      );

      posthog?.capture("notification_clicked", {
        notificationId: notification.id,
        category: notification.category ?? "unknown category",
        webAppLocation: destination ?? "",
      });

      if (destination) {
        router.push(destination as RelativePathString);
      }
    },
    [posthog, queryClient]
  );

  const renderNotification = useCallback(
    ({ item: notification }: { item: NotificationDto }) => {
      return (
        <SwipeableNotification
          key={notification.id}
          notification={notification}
          onPress={() => handleNotificationPress(notification)}
          onMarkRead={() => handleMarkAsRead(notification.id)}
        />
      );
    },
    [handleNotificationPress, handleMarkAsRead]
  );

  return (
    <GreenHeader>
      {isPending ? (
        <View className="flex-1">
          <View className="bg-green p-4 pt-12 pb-3 flex-row items-center justify-between">
            <Text className="text-white font-bold">Notifications</Text>
          </View>
          <View className="flex-1 items-center justify-center bg-white">
            <ActivityIndicator size="large" color="#0D1B2A" />
          </View>
        </View>
      ) : error ? (
        <View className="flex-1">
          <View className="bg-green p-4 pt-12 pb-3 flex-row items-center justify-between">
            <Text className="text-white font-bold">Notifications</Text>
          </View>
          <View className="flex-1 items-center justify-center bg-white">
            <Text className="text-center text-red-500">{error.message}</Text>
          </View>
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1">
          <View className="bg-green p-4 pt-12 pb-3 flex-row items-center justify-between">
            <Text className="text-white font-bold">Notifications</Text>
          </View>
          <View className="flex-1 items-center justify-center bg-white">
            <Text className="text-zinc-500">You&apos;re all caught up.</Text>
          </View>
        </View>
      ) : (
        <LegendList
          ListHeaderComponent={
            <View className="bg-green p-4 pt-12 pb-3 flex-row items-center justify-between">
              <Text className="text-white font-bold">Notifications</Text>
              {unreadCount > 0 && (
                <Button
                  color={ButtonColor.White}
                  size={ButtonSize.Small}
                  onPress={handleMarkAllAsRead}
                  title="Mark all as read"
                />
              )}
            </View>
          }
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={isPending} onRefresh={refetch} />
          }
          recycleItems
          renderItem={renderNotification}
          contentContainerStyle={{
            paddingBottom: 40,
            backgroundColor: "white",
          }}
        />
      )}
    </GreenHeader>
  );
}
