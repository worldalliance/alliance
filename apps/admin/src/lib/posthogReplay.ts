const POSTHOG_REPLAY_BASE =
  "https://us.posthog.com/project/188181/replay/home?sessionRecordingId=";

/** Where PostHog plays a response's session recording, from the URL stored on the response. */
export const posthogReplayHref = (sessionReplayUrl: string): string =>
  `${POSTHOG_REPLAY_BASE}${sessionReplayUrl.slice(sessionReplayUrl.lastIndexOf("/") + 1)}`;
