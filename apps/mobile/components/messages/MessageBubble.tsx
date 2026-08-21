import { MessageDto } from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { Reply } from "lucide-react-native";
import { useMemo } from "react";
import { TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { getImageSource } from "../../lib/config";
import AppMarkdownWrapper from "../AppMarkdownWrapper";
import ImageLightbox from "../ImageLightbox";
import ProfileImage from "../ProfileImage";
import Text, { FontWeight } from "../system/Text";

interface MessageBubbleProps {
  message: MessageDto;
  isFirstInGroup?: boolean;
  isFirstInReplyGroup?: boolean;
  isFocused?: boolean;
  onReply?: (messageId: string) => void;
  onFocusReply?: (messageId: string) => void;
}

const SWIPE_THRESHOLD = -80;

const resolveAttachmentUri = (attachment: string) => {
  if (
    attachment.startsWith("data:") ||
    attachment.startsWith("file:") ||
    attachment.startsWith("http")
  ) {
    return attachment;
  }
  return getImageSource(attachment);
};

export default function MessageBubble({
  message,
  isFirstInGroup = false,
  isFirstInReplyGroup = false,
  isFocused = false,
  onReply,
  onFocusReply,
}: MessageBubbleProps) {
  const resolvedUris = useMemo(
    () => message.attachments.map(resolveAttachmentUri),
    [message.attachments],
  );
  const translateX = useSharedValue(0);

  const timeLabel = useMemo(() => {
    return formatTime(new Date(message.createdAt), { addSuffix: true }).replace(
      "less than a minute ago",
      "now",
    );
  }, [message.createdAt]);

  const panGesture = Gesture.Pan()
    .enabled(!!onReply)
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      translateX.value = Math.min(0, event.translationX);
    })
    .onEnd(() => {
      if (translateX.value < SWIPE_THRESHOLD && onReply) {
        scheduleOnRN(onReply, message.id);
      }
      translateX.value = withSpring(0);
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
      [1, 0.4, 0],
      Extrapolation.CLAMP,
    );
    return { width, opacity };
  });

  return (
    <View className={cn(isFocused && "bg-green-100")}>
      <View className="overflow-hidden px-4">
        <Animated.View
          style={[actionStyle]}
          className="absolute right-0 top-0 bottom-0 bg-zinc-200 items-center justify-center"
        >
          <View className="w-16 items-center justify-center">
            <Reply size={18} />
          </View>
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View style={contentStyle}>
            {message.replyTo && isFirstInReplyGroup && (
              <TouchableOpacity
                className="flex-row items-center gap-2 ml-10 mb-1"
                onPress={() => onFocusReply?.(message.replyTo!.id)}
              >
                <Reply size={14} color="#71717a" />
                <ProfileImage
                  pfp={message.replyTo.author.profilePicture}
                  size="mini"
                />
                <Text className="text-xs text-zinc-500" numberOfLines={1}>
                  Replying to: {message.replyTo.body || "image"}
                </Text>
              </TouchableOpacity>
            )}
            <View className="flex-row gap-3">
              <View className="w-8">
                {isFirstInGroup && (
                  <ProfileImage
                    pfp={message.author.profilePicture}
                    size="medium"
                  />
                )}
              </View>
              <View className="flex-1">
                {isFirstInGroup && (
                  <View className="flex-row items-center gap-2">
                    <Text className="text-zinc-900" weight={FontWeight.Medium}>
                      {message.author.displayName}
                    </Text>
                    <Text className="text-xs text-zinc-500">{timeLabel}</Text>
                  </View>
                )}
                {message.body ? (
                  <AppMarkdownWrapper>{message.body}</AppMarkdownWrapper>
                ) : null}
                {resolvedUris.length > 0 && (
                  <View className="flex-row flex-wrap gap-2 mb-2">
                    <ImageLightbox
                      uris={resolvedUris}
                      thumbnailClassName="w-24 h-24 rounded border border-zinc-200"
                    />
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}
