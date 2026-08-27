import { useVideoAnalytics } from "@alliance/shared/lib/useVideoAnalytics";
import {
  SHOWS_SPINNER,
  useVideoSource,
  VIDEO_LOAD_FAILED_MESSAGE,
  VIDEO_RETRY_LABEL,
  VideoLoadState,
} from "@alliance/shared/lib/useVideoSource";
import Hls from "hls.js";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiUrl } from "../lib/config";

type VideoPlayerProps = {
  src: string;
  videoId?: number;
  caption?: string;
};

export default function VideoPlayer({
  src,
  videoId,
  caption,
}: VideoPlayerProps) {
  // The element is in state, not a ref, so the attach effect re-runs against
  // whichever element is mounted, and `key={attempt}` mounts a fresh one per retry.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const { manifestUrl, state, attempt, onReady, onError, retry } =
    useVideoSource({
      src,
      videoId,
      apiUrl: getApiUrl(),
    });
  const { trackPlay, trackComplete, trackTimeUpdate } = useVideoAnalytics({
    src,
    videoId,
    enabled: manifestUrl !== null,
  });

  useEffect(() => {
    if (!video) return;

    const onPlay = () => trackPlay();
    const onEnded = () => trackComplete();
    const onTimeUpdate = () =>
      trackTimeUpdate({
        currentTime: video.currentTime,
        duration: video.duration,
      });

    video.addEventListener("play", onPlay);
    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [video, trackPlay, trackComplete, trackTimeUpdate]);

  useEffect(() => {
    if (!video || !manifestUrl) return;

    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);

    const detachSource = Hls.isSupported()
      ? attachHls({ video, manifestUrl, onFatalError: onError })
      : attachNative({ video, manifestUrl, onFatalError: onError });

    return () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
      detachSource();
    };
  }, [video, manifestUrl, onReady, onError]);

  if (state === VideoLoadState.Failed) {
    return (
      <figure className="mx-auto max-w-full text-center">
        <div
          role="alert"
          className="flex items-center justify-center gap-2 h-48 bg-red-50 rounded"
        >
          <p className="text-sm text-red-600">{VIDEO_LOAD_FAILED_MESSAGE}</p>
          {manifestUrl && (
            <button
              type="button"
              onClick={retry}
              aria-label={VIDEO_RETRY_LABEL}
              title={VIDEO_RETRY_LABEL}
              className="rounded p-1 text-red-600 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
        {caption && (
          <figcaption className="mt-2 text-sm text-gray-600">
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <figure className="mx-auto max-w-full text-center">
      <div className="relative mx-auto min-h-48">
        <video
          key={attempt}
          ref={setVideo}
          controls
          className="mx-auto max-h-120 w-auto rounded"
        />
        {SHOWS_SPINNER[state] && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gray-100/80 rounded">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-green border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-600">{"Loading video..."}</p>
            </div>
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-2 text-sm text-gray-600">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

type AttachSourceParams = {
  video: HTMLVideoElement;
  manifestUrl: string;
  onFatalError: () => void;
};

const attachHls = ({
  video,
  manifestUrl,
  onFatalError,
}: AttachSourceParams) => {
  const hls = new Hls({
    fragLoadPolicy: {
      default: {
        maxTimeToFirstByteMs: 10000,
        maxLoadTimeMs: 10000,
        timeoutRetry: {
          maxNumRetry: 3,
          retryDelayMs: 1000,
          maxRetryDelayMs: 1000,
        },
        errorRetry: {
          maxNumRetry: 3,
          retryDelayMs: 1000,
          maxRetryDelayMs: 1000,
        },
      },
    },
  });

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal) onFatalError();
  });
  hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
    if (hls.subtitleTracks.length > 0) {
      hls.subtitleDisplay = false;
    }
  });

  hls.loadSource(manifestUrl);
  hls.attachMedia(video);

  return () => hls.destroy();
};

const attachNative = ({
  video,
  manifestUrl,
  onFatalError,
}: AttachSourceParams) => {
  if (!video.canPlayType("application/vnd.apple.mpegurl")) {
    onFatalError();
    return () => {};
  }

  video.src = manifestUrl;

  return () => {
    video.removeAttribute("src");
    video.load();
  };
};
