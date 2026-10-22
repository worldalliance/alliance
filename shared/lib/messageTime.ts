import { formatTime } from "./utils";

const NOW_WINDOW_MS = 60_000;

// A message dated after the device clock was sent by a server whose clock runs ahead.
export const formatMessageTime = (time: Date) =>
  Date.now() - time.getTime() < NOW_WINDOW_MS
    ? "now"
    : formatTime(time, { addSuffix: true });
