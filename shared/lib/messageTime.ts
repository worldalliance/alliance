import { formatTime } from "./utils";

export const formatMessageTime = (time: Date) =>
  formatTime(time, { addSuffix: true }).replace(
    "less than a minute ago",
    "now",
  );
