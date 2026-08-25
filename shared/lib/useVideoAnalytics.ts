import { AnalyticsEvent } from "@alliance/common/analytics";
import { useCallback, useEffect, useRef } from "react";
import { captureEvent } from "./analytics";

const PROGRESS_INTERVAL_S = 5;
const COMPLETE_WITHIN_S = 3;

type UseVideoAnalyticsParams = {
  src: string;
  videoId?: number;
  enabled: boolean;
};

export const useVideoAnalytics = ({
  src,
  videoId,
  enabled,
}: UseVideoAnalyticsParams) => {
  const lastTrackedTimeRef = useRef(0);
  const hasTrackedPlayRef = useRef(false);
  const hasTrackedCompleteRef = useRef(false);

  useEffect(() => {
    lastTrackedTimeRef.current = 0;
    hasTrackedPlayRef.current = false;
    hasTrackedCompleteRef.current = false;
  }, [src, videoId]);

  useEffect(() => {
    if (!enabled) return;

    captureEvent(AnalyticsEvent.VideoSeen, { videoId });
  }, [enabled, videoId]);

  const trackPlay = useCallback(() => {
    if (hasTrackedPlayRef.current) return;

    hasTrackedPlayRef.current = true;
    captureEvent(AnalyticsEvent.VideoStarted, { videoId, src });
  }, [videoId, src]);

  const trackComplete = useCallback(() => {
    if (hasTrackedCompleteRef.current) return;

    hasTrackedCompleteRef.current = true;
    captureEvent(AnalyticsEvent.VideoFullyWatched, { videoId, src });
  }, [videoId, src]);

  const trackTimeUpdate = useCallback(
    ({ currentTime, duration }: { currentTime: number; duration: number }) => {
      if (!Number.isFinite(duration) || duration <= 0) return;

      if (duration - currentTime <= COMPLETE_WITHIN_S) {
        trackComplete();
      }

      if (currentTime > lastTrackedTimeRef.current + PROGRESS_INTERVAL_S) {
        lastTrackedTimeRef.current = currentTime;
        captureEvent(AnalyticsEvent.VideoProgress, {
          videoId,
          src,
          progress: Math.floor(currentTime),
          duration: Math.floor(duration),
        });
      }
    },
    [videoId, src, trackComplete],
  );

  return { trackPlay, trackComplete, trackTimeUpdate };
};
