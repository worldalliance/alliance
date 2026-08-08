import { AnalyticsEvent } from "@alliance/common/analytics";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { getApiUrl } from "../../lib/config";
import Text from "../system/Text";

type VideoPlayerProps = {
  src: string;
  videoId: number;
  caption?: string;
};

const resolveManifestUrl = (src: string, videoId?: number) => {
  if (src.startsWith("http")) {
    return `${src}/playlist.m3u8`;
  }

  if (videoId) {
    return `${getApiUrl()}/videos/${videoId}/playlist.m3u8`;
  }

  return src;
};

const VideoPlayer = ({ src, videoId, caption }: VideoPlayerProps) => {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    videoId ? "loading" : "ready",
  );
  const [mediaReady, setMediaReady] = useState(false);
  const hasVideo = !!(src || videoId);
  const lastTrackedTimeRef = useRef(0);
  const hasTrackedPlayRef = useRef(false);
  const hasTrackedCompleteRef = useRef(false);

  const manifestUrl = useMemo(() => {
    if (status !== "ready") {
      return null;
    }

    return resolveManifestUrl(src, videoId);
  }, [src, status, videoId]);

  const player = useVideoPlayer(
    manifestUrl
      ? {
          uri: manifestUrl,
          contentType: "hls",
        }
      : null,
    (instance) => {
      instance.timeUpdateEventInterval = 5;
      instance.keepScreenOnWhilePlaying = true;
    },
  );

  useEffect(() => {
    setStatus(videoId ? "loading" : "ready");
    setMediaReady(false);
    lastTrackedTimeRef.current = 0;
    hasTrackedPlayRef.current = false;
    hasTrackedCompleteRef.current = false;
  }, [src, videoId]);

  useEffect(() => {
    if (!videoId || status !== "loading") return;

    let cancelled = false;
    let cleanupInterval: ReturnType<typeof setInterval> | undefined;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/videos/${videoId}/status`);
        if (cancelled) return true;

        if (res.status === 404) {
          setStatus("failed");
          return true;
        }

        if (!res.ok) {
          return false;
        }

        const data = (await res.json()) as { status?: "ready" | "failed" };
        if (data.status === "ready" || data.status === "failed") {
          setStatus(data.status);
          return true;
        }
      } catch {
        // Ignore transient polling errors and keep retrying.
      }

      return false;
    };

    void checkStatus().then((done) => {
      if (done || cancelled) return;

      const interval = setInterval(async () => {
        const finished = await checkStatus();
        if (finished || cancelled) {
          clearInterval(interval);
        }
      }, 3000);

      cleanupInterval = interval;
    });

    return () => {
      cancelled = true;
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
    };
  }, [status, videoId]);

  useEffect(() => {
    captureEvent(AnalyticsEvent.VideoSeen, { videoId });
  }, [videoId]);

  useEffect(() => {
    if (!player) return;

    const statusSubscription = player.addListener(
      "statusChange",
      ({ status }) => {
        if (status === "error") {
          setStatus("failed");
        }
      },
    );

    const playingSubscription = player.addListener(
      "playingChange",
      ({ isPlaying }) => {
        if (!isPlaying || hasTrackedPlayRef.current) return;

        hasTrackedPlayRef.current = true;
        captureEvent(AnalyticsEvent.VideoStarted, { videoId, src });
      },
    );

    const timeSubscription = player.addListener(
      "timeUpdate",
      ({ currentTime }) => {
        const duration = player.duration;

        if (
          !hasTrackedCompleteRef.current &&
          duration > 0 &&
          duration - currentTime <= 3
        ) {
          hasTrackedCompleteRef.current = true;
          captureEvent(AnalyticsEvent.VideoFullyWatched, { videoId, src });
        }

        if (currentTime > lastTrackedTimeRef.current + 5) {
          lastTrackedTimeRef.current = currentTime;
          captureEvent(AnalyticsEvent.VideoProgress, {
            videoId,
            src,
            progress: Math.floor(currentTime),
            duration: Math.floor(duration),
          });
        }
      },
    );

    const endSubscription = player.addListener("playToEnd", () => {
      if (hasTrackedCompleteRef.current) return;

      hasTrackedCompleteRef.current = true;
      captureEvent(AnalyticsEvent.VideoFullyWatched, { videoId, src });
    });

    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
      timeSubscription.remove();
      endSubscription.remove();
    };
  }, [player, src, videoId]);

  if (!hasVideo) return null;

  if (status === "failed") {
    return (
      <View className="items-center">
        <View className="h-48 w-full items-center justify-center rounded-lg bg-red-50 px-4">
          <Text className="text-sm text-red-600">Could not load video.</Text>
        </View>
        {caption ? (
          <Text className="mt-2 text-center text-sm text-zinc-600">
            {caption}
          </Text>
        ) : null}
      </View>
    );
  }

  const showSpinner = status === "loading" || !mediaReady;

  return (
    <View className="items-center">
      <View
        className="w-full overflow-hidden rounded-lg bg-zinc-950"
        style={{ aspectRatio: 16 / 9 }}
      >
        {status === "ready" ? (
          <VideoView
            player={player}
            nativeControls
            contentFit="contain"
            fullscreenOptions={{ enable: true }}
            onFirstFrameRender={() => setMediaReady(true)}
            style={{ flex: 1 }}
            surfaceType={Platform.OS === "android" ? "textureView" : undefined}
          />
        ) : null}
        {showSpinner ? (
          <View className="absolute inset-0 items-center justify-center bg-zinc-100">
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
