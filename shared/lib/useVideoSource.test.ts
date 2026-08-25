import { act, cleanup, renderHook } from "@testing-library/react";
import { useVideoSource, VideoLoadState } from "./useVideoSource";

const API_URL = "https://api.test";

function mountSource(props: { src: string; videoId?: number }) {
  return renderHook(
    ({ src, videoId }: { src: string; videoId?: number }) =>
      useVideoSource({ src, videoId, apiUrl: API_URL }),
    { initialProps: props },
  );
}

describe("useVideoSource", () => {
  afterEach(cleanup);

  it("resolves the manifest from the video id, preferring an absolute src", () => {
    const { result: byId } = mountSource({ src: "videos/abc", videoId: 7 });
    expect(byId.current.manifestUrl).toBe(`${API_URL}/videos/7/playlist.m3u8`);

    const { result: byUrl } = mountSource({
      src: "https://cdn.test/v/abc",
      videoId: 7,
    });
    expect(byUrl.current.manifestUrl).toBe(
      "https://cdn.test/v/abc/playlist.m3u8",
    );
  });

  it("fails with nothing to retry when the block has no video at all", () => {
    const { result } = mountSource({ src: "" });

    expect(result.current.state).toBe(VideoLoadState.Failed);
    expect(result.current.manifestUrl).toBeNull();
  });

  it("loads until the media reports itself ready", () => {
    const { result } = mountSource({ src: "videos/abc", videoId: 1 });
    expect(result.current.state).toBe(VideoLoadState.Loading);

    act(() => result.current.onReady());
    expect(result.current.state).toBe(VideoLoadState.Ready);
  });

  it("fails on an error, whether or not the media was already ready", () => {
    const { result: early } = mountSource({ src: "videos/abc", videoId: 1 });
    act(() => early.current.onError());
    expect(early.current.state).toBe(VideoLoadState.Failed);

    const { result: late } = mountSource({ src: "videos/abc", videoId: 1 });
    act(() => late.current.onReady());
    act(() => late.current.onError());
    expect(late.current.state).toBe(VideoLoadState.Failed);
  });

  it("returns to loading on a retry and counts the attempt", () => {
    const { result } = mountSource({ src: "videos/abc", videoId: 1 });
    expect(result.current.attempt).toBe(0);

    act(() => result.current.onError());
    act(() => result.current.retry());

    expect(result.current.state).toBe(VideoLoadState.Loading);
    expect(result.current.attempt).toBe(1);
  });

  it("applies a callback captured before a retry to the load after it", () => {
    const { result } = mountSource({ src: "videos/abc", videoId: 1 });

    const { onError } = result.current;
    act(() => result.current.retry());
    act(() => onError());

    expect(result.current.state).toBe(VideoLoadState.Failed);
  });

  it("drops the error and the attempt count when the source changes", () => {
    const { result, rerender } = mountSource({ src: "videos/abc", videoId: 1 });

    act(() => result.current.onError());
    act(() => result.current.retry());
    rerender({ src: "videos/def", videoId: 2 });

    expect(result.current.manifestUrl).toBe(
      `${API_URL}/videos/2/playlist.m3u8`,
    );
    expect(result.current.state).toBe(VideoLoadState.Loading);
    expect(result.current.attempt).toBe(0);
  });
});
