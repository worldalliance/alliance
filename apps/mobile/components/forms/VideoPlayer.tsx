import { useVideoAnalytics } from "@alliance/shared/lib/useVideoAnalytics";
import {
  SHOWS_SPINNER,
  useVideoSource,
  VIDEO_LOAD_FAILED_MESSAGE,
  VIDEO_RETRY_LABEL,
  VideoLoadState,
} from "@alliance/shared/lib/useVideoSource";
import { useVideoPlayer, VideoView } from "expo-video";
import { RotateCcw } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  View,
} from "react-native";
import { getApiUrl } from "../../lib/config";
import Text from "../system/Text";

type VideoPlayerProps = {
  src: string;
  videoId?: number;
  caption?: string;
};

const VideoPlayer = ({ src, videoId, caption }: VideoPlayerProps) => {
  const { manifestUrl, state, attempt, onReady, onError, retry } =
    useVideoSource({ src, videoId, apiUrl: getApiUrl() });
  const { trackPlay, trackComplete, trackTimeUpdate } = useVideoAnalytics({
    src,
    videoId,
    enabled: manifestUrl !== null,
  });

  const source = useMemo(
    () =>
      manifestUrl ? { uri: manifestUrl, contentType: "hls" as const } : null,
    [manifestUrl],
  );

  const player = useVideoPlayer(source, (instance) => {
    instance.timeUpdateEventInterval = 5;
    instance.keepScreenOnWhilePlaying = true;
  });

  // A retry reuses the player the source built, and AVPlayer and ExoPlayer both
  // need an explicit reload to leave a fatal error behind.
  useEffect(() => {
    if (attempt === 0 || !source) return;

    player.replaceAsync(source).catch(onError);
  }, [player, source, attempt, onError]);

  useEffect(() => {
    // The player is built during render, so read the status the listener missed.
    if (player.status === "readyToPlay") onReady();
    if (player.status === "error") onError();

    const statusSubscription = player.addListener(
      "statusChange",
      ({ status }) => {
        // A paused player can be ready without rendering a frame, so this clears
        // the spinner that `onFirstFrameRender` alone would leave up.
        if (status === "readyToPlay") onReady();
        if (status === "error") onError();
      },
    );

    const playingSubscription = player.addListener(
      "playingChange",
      ({ isPlaying }) => {
        if (isPlaying) trackPlay();
      },
    );

    const timeSubscription = player.addListener(
      "timeUpdate",
      ({ currentTime }) => {
        trackTimeUpdate({ currentTime, duration: player.duration });
      },
    );

    const endSubscription = player.addListener("playToEnd", trackComplete);

    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
      timeSubscription.remove();
      endSubscription.remove();
    };
  }, [player, onReady, onError, trackPlay, trackComplete, trackTimeUpdate]);

  if (state === VideoLoadState.Failed) {
    return (
      <View className="items-center">
        <View
          accessibilityRole="alert"
          className="h-48 w-full flex-row items-center justify-center gap-2 rounded-lg bg-red-50 px-4"
        >
          <Text className="text-sm text-red-600">
            {VIDEO_LOAD_FAILED_MESSAGE}
          </Text>
          {manifestUrl ? (
            <TouchableOpacity
              onPress={retry}
              accessibilityRole="button"
              accessibilityLabel={VIDEO_RETRY_LABEL}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="p-1"
            >
              <RotateCcw size={16} color="#dc2626" />
            </TouchableOpacity>
          ) : null}
        </View>
        {caption ? (
          <Text className="mt-2 text-center text-sm text-zinc-600">
            {caption}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="items-center">
      <View
        className="w-full overflow-hidden rounded-lg bg-zinc-950"
        style={{ aspectRatio: 16 / 9 }}
      >
        <VideoView
          player={player}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
          onFirstFrameRender={onReady}
          style={{ flex: 1 }}
          surfaceType={Platform.OS === "android" ? "textureView" : undefined}
        />
        {SHOWS_SPINNER[state] ? (
          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center bg-zinc-100/80"
          >
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="mt-2 text-sm text-zinc-600">Loading video...</Text>
          </View>
        ) : null}
      </View>
      {caption ? (
        <Text className="mt-2 text-center text-sm text-zinc-600">
          {caption}
        </Text>
      ) : null}
    </View>
  );
};

export default VideoPlayer;
