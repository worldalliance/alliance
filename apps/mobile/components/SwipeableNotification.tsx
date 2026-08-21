import { NotificationDto } from "@alliance/shared/client";
import { getNotificationTime } from "@alliance/shared/lib/notificationBucketing";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { Check, CheckCheck } from "lucide-react-native";
import { Pressable, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import ProfileImage from "./ProfileImage";
import Text, { FontWeight } from "./system/Text";

const SWIPE_THRESHOLD = -80;

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
        scheduleOnRN(onMarkRead);
      }
      translateX.value = withSpring(0, { duration: 300, dampingRatio: 0.8 });
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionStyle = useAnimatedStyle(() => {
    const width = interpolate(
      translateX.value,
      [SWIPE_THRESHOLD, 0],
      [-SWIPE_THRESHOLD, 0],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      translateX.value,
      [SWIPE_THRESHOLD, -20, 0],
      [1, 0.5, 0],
      Extrapolation.CLAMP,
    );
    return {
      width,
      opacity,
    };
  });

  return (
    <View className="overflow-hidden mx-px">
      {/* Background action area */}
      <Animated.View
        style={[actionStyle]}
        className="absolute right-0 top-0 bottom-0 bg-green items-center justify-center"
      >
        <View className="flex-row items-center gap-x-1 px-3">
          <Check size={16} color="white" />
          <Text
            className="text-white text-sm text-nowrap whitespace-nowrap"
            weight={FontWeight.Medium}
          >
            Read
          </Text>
        </View>
      </Animated.View>

      {/* Swipeable content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={contentStyle}>
          <Pressable
            onPress={onPress}
            className={cn(
              notification.readAt ? "bg-white" : "bg-red-50",
              "p-4",
            )}
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
                    <Text weight={FontWeight.Semibold}>Action update: </Text>
                  )}
                  {notification.message}
                </Text>
              </View>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-xs text-zinc-500">
                  {formatTime(getNotificationTime(notification), {
                    addSuffix: true,
                  })}
                </Text>
                {isUnread && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={onMarkRead}
                    className="flex-row items-center gap-x-1"
                  >
                    <CheckCheck size={12} color="#71717a" />
                    <Text className="text-xs text-zinc-500">Mark as read</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default SwipeableNotification;
