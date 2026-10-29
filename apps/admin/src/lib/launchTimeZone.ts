export const LAUNCH_TIME_ZONE = "America/Los_Angeles";

export const inLaunchZone = (date: Date) =>
  `${date.toLocaleString("en-US", {
    timeZone: LAUNCH_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  })} PT`;
