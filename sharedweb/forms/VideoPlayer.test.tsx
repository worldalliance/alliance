import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  registerAnalytics,
  type AnalyticsBackend,
} from "@alliance/shared/lib/analytics";
import {
  VIDEO_LOAD_FAILED_MESSAGE,
  VIDEO_RETRY_LABEL,
} from "@alliance/shared/lib/useVideoSource";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import VideoPlayer from "./VideoPlayer";

const SRC = "https://cdn.test/v/abc";
const MANIFEST = `${SRC}/playlist.m3u8`;

// happy-dom lacks MediaSource, so force the native HLS path used by Safari and iOS.
let nativeHlsSupported = true;

const realCanPlayType = HTMLMediaElement.prototype.canPlayType;

beforeAll(() => {
  HTMLMediaElement.prototype.canPlayType = (type: string) =>
    nativeHlsSupported && type === "application/vnd.apple.mpegurl"
      ? "probably"
      : "";
});

afterAll(() => {
  HTMLMediaElement.prototype.canPlayType = realCanPlayType;
});

let captured: string[] = [];

const recordingBackend: AnalyticsBackend = {
  capture: (event) => {
    captured.push(event);
  },
  captureException: () => {},
};

beforeEach(() => {
  captured = [];
  nativeHlsSupported = true;
  registerAnalytics(recordingBackend);
});

afterEach(cleanup);

const videoElement = (): HTMLVideoElement => {
  const video = document.querySelector("video");
  if (!video) throw new Error("no video element is rendered");
  return video;
};

const retryButton = () =>
  screen.getByRole("button", { name: VIDEO_RETRY_LABEL });

const startsTracked = () =>
  captured.filter((event) => event === AnalyticsEvent.VideoStarted).length;

describe("VideoPlayer", () => {
  it("mounts the player behind a spinner and attaches the manifest", () => {
    render(<VideoPlayer src={SRC} />);

    expect(videoElement().getAttribute("src")).toBe(MANIFEST);
    expect(screen.getByText("Loading video...")).toBeTruthy();

    fireEvent.loadedData(videoElement());

    expect(screen.queryByText("Loading video...")).toBeNull();
  });

  it("shows the failed state for an error before the first frame", () => {
    render(<VideoPlayer src={SRC} />);

    fireEvent.error(videoElement());

    expect(screen.getByText(VIDEO_LOAD_FAILED_MESSAGE)).toBeTruthy();
    expect(document.querySelector("video")).toBeNull();
    expect(retryButton()).toBeTruthy();
  });

  it("shows the failed state for an error after the first frame too", () => {
    render(<VideoPlayer src={SRC} />);

    fireEvent.loadedData(videoElement());
    fireEvent.error(videoElement());

    expect(screen.getByText(VIDEO_LOAD_FAILED_MESSAGE)).toBeTruthy();
    expect(document.querySelector("video")).toBeNull();
  });

  it("renders the failed state with no retry when there is no video at all", () => {
    render(<VideoPlayer src="" />);

    expect(screen.getByText(VIDEO_LOAD_FAILED_MESSAGE)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: VIDEO_RETRY_LABEL }),
    ).toBeNull();
  });

  it("gives up when nothing can play the manifest", () => {
    nativeHlsSupported = false;

    render(<VideoPlayer src={SRC} />);

    expect(screen.getByText(VIDEO_LOAD_FAILED_MESSAGE)).toBeTruthy();
  });

  it("re-attaches the manifest to the element a retry remounts", () => {
    render(<VideoPlayer src={SRC} />);

    const initial = videoElement();
    fireEvent.error(initial);
    fireEvent.click(retryButton());

    const retried = videoElement();
    expect(retried).not.toBe(initial);
    expect(retried.getAttribute("src")).toBe(MANIFEST);
    expect(screen.getByText("Loading video...")).toBeTruthy();

    fireEvent.loadedData(retried);
    fireEvent.play(retried);

    expect(startsTracked()).toBe(1);
  });

  it("tracks a start once, however often playback resumes", () => {
    render(<VideoPlayer src={SRC} />);

    const video = videoElement();
    fireEvent.loadedData(video);
    fireEvent.play(video);
    fireEvent.play(video);

    expect(startsTracked()).toBe(1);
  });
});
