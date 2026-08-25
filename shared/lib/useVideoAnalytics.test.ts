import { AnalyticsEvent } from "@alliance/common/analytics";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  registerAnalytics,
  type AnalyticsBackend,
  type AnalyticsProperties,
} from "./analytics";
import { useVideoAnalytics } from "./useVideoAnalytics";

type CapturedEvent = { event: string; properties?: AnalyticsProperties };

let captured: CapturedEvent[] = [];

const recordingBackend: AnalyticsBackend = {
  capture: (event, properties) => {
    captured.push({ event, properties });
  },
  captureException: () => {},
};

const countOf = (event: AnalyticsEvent) =>
  captured.filter((entry) => entry.event === event).length;

type Props = { src: string; videoId?: number; enabled?: boolean };

function mountAnalytics(props: Props) {
  return renderHook(
    ({ src, videoId, enabled = true }: Props) =>
      useVideoAnalytics({ src, videoId, enabled }),
    { initialProps: props },
  );
}

describe("useVideoAnalytics", () => {
  beforeEach(() => {
    captured = [];
    registerAnalytics(recordingBackend);
  });
  afterEach(cleanup);

  it("reports the video as seen once per source, and not when there is none", () => {
    const { rerender } = mountAnalytics({ src: "videos/abc", videoId: 1 });
    expect(countOf(AnalyticsEvent.VideoSeen)).toBe(1);

    rerender({ src: "videos/abc", videoId: 1 });
    expect(countOf(AnalyticsEvent.VideoSeen)).toBe(1);

    captured = [];
    mountAnalytics({ src: "", enabled: false });
    expect(countOf(AnalyticsEvent.VideoSeen)).toBe(0);
  });

  it("reports a start once, however many times playback resumes", () => {
    const { result } = mountAnalytics({ src: "videos/abc", videoId: 1 });

    act(() => {
      result.current.trackPlay();
      result.current.trackPlay();
    });

    expect(countOf(AnalyticsEvent.VideoStarted)).toBe(1);
  });

  it("reports progress on a stride and completion once, near the end", () => {
    const { result } = mountAnalytics({ src: "videos/abc", videoId: 1 });

    act(() => {
      result.current.trackTimeUpdate({ currentTime: 3, duration: 100 });
      result.current.trackTimeUpdate({ currentTime: 6, duration: 100 });
      result.current.trackTimeUpdate({ currentTime: 12, duration: 100 });
    });
    expect(countOf(AnalyticsEvent.VideoProgress)).toBe(2);

    act(() => {
      result.current.trackTimeUpdate({ currentTime: 98, duration: 100 });
      result.current.trackComplete();
    });
    expect(countOf(AnalyticsEvent.VideoFullyWatched)).toBe(1);
  });

  it("ignores time updates from media of unknown duration", () => {
    const { result } = mountAnalytics({ src: "videos/abc", videoId: 1 });

    act(() => {
      result.current.trackTimeUpdate({ currentTime: 30, duration: NaN });
      result.current.trackTimeUpdate({ currentTime: 60, duration: 0 });
    });

    expect(countOf(AnalyticsEvent.VideoProgress)).toBe(0);
    expect(countOf(AnalyticsEvent.VideoFullyWatched)).toBe(0);
  });

  it("re-arms the guards when the source changes", () => {
    const { result, rerender } = mountAnalytics({
      src: "videos/abc",
      videoId: 1,
    });

    act(() => result.current.trackPlay());
    rerender({ src: "videos/def", videoId: 2 });
    act(() => result.current.trackPlay());

    expect(countOf(AnalyticsEvent.VideoStarted)).toBe(2);
  });
});
