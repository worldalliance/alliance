import { useCallback, useMemo, useState } from "react";

export const VIDEO_LOAD_FAILED_MESSAGE = "Could not load video.";
export const VIDEO_RETRY_LABEL = "Reload video";

export enum VideoLoadState {
  Loading = "loading",
  Ready = "ready",
  Failed = "failed",
}

export const SHOWS_SPINNER: Record<VideoLoadState, boolean> = {
  [VideoLoadState.Loading]: true,
  [VideoLoadState.Ready]: false,
  [VideoLoadState.Failed]: false,
};

type Load = {
  sourceKey: string;
  attempt: number;
  state: VideoLoadState;
};

const freshLoad = (sourceKey: string): Load => ({
  sourceKey,
  attempt: 0,
  state: VideoLoadState.Loading,
});

type UseVideoSourceParams = {
  src: string;
  videoId?: number;
  apiUrl: string;
};

export const useVideoSource = ({
  src,
  videoId,
  apiUrl,
}: UseVideoSourceParams) => {
  const sourceKey = `${videoId ?? ""}:${src}`;

  const manifestUrl = useMemo(() => {
    if (src.startsWith("http")) return `${src}/playlist.m3u8`;
    if (videoId !== undefined) {
      return `${apiUrl}/videos/${videoId}/playlist.m3u8`;
    }
    return src || null;
  }, [src, videoId, apiUrl]);

  const [load, setLoad] = useState<Load>(() => freshLoad(sourceKey));
  // Reset during render so a source change never renders a frame of stale state.
  if (load.sourceKey !== sourceKey) {
    setLoad(freshLoad(sourceKey));
  }

  // Functional updates let a callback captured before a retry update the load after it.
  const onReady = useCallback(() => {
    setLoad((current) => ({ ...current, state: VideoLoadState.Ready }));
  }, []);

  const onError = useCallback(() => {
    setLoad((current) => ({ ...current, state: VideoLoadState.Failed }));
  }, []);

  const retry = useCallback(() => {
    setLoad((current) => ({
      ...current,
      attempt: current.attempt + 1,
      state: VideoLoadState.Loading,
    }));
  }, []);

  return {
    manifestUrl,
    state: manifestUrl === null ? VideoLoadState.Failed : load.state,
    attempt: load.attempt,
    onReady,
    onError,
    retry,
  };
};
