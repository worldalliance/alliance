import { Href } from "expo-router";

export function notificationRoute(
  location: string | null | undefined,
): Href | null {
  if (!location) return null;
  const normalized = location.startsWith("/") ? location : `/${location}`;
  const segments = normalized.split("?")[0].split("/").filter(Boolean);

  // Mobile has no tasks screen.
  if (segments[0] === "tasks") {
    return "/";
  }

  // The server supplies the path, so typed routes can't check it.
  return normalized as Href;
}
