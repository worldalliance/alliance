import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const LAUNCH_TIME_ZONE = "America/Los_Angeles";

export const inLaunchZone = (date: Date) =>
  `${format(new TZDate(date, LAUNCH_TIME_ZONE), "MMM d, yyyy 'at' h:mm a")} PT`;
