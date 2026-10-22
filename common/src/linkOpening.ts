import { millisecondsInDay } from "date-fns/constants";

export const TRACKING_PARAM = "cid";

export const TRACKING_ID = /^[\w-]{1,64}$/;

export enum LinkOpeningPlatform {
  Web = "web",
  Mobile = "mobile",
}

export const LINK_OPENING_DEADLINE_MS = millisecondsInDay;

export const MAX_DESTINATION_LENGTH = 512;

// Only parameters that pick out content; any other may carry a bearer token,
// such as an invite code or an unsubscribe token.
const CONTENT_PARAMS = ["communityId", "replyId", "tab"];
const SAFE_VALUE = /^[\w-]{1,64}$/;
const SAFE_SEGMENT = /^[\w.-]{1,128}$/;

/**
 * The analytics form of an app path: no fragment, no query parameter that
 * doesn't identify content, and `:param` in place of any segment that isn't
 * a plain word or ID. Past `MAX_DESTINATION_LENGTH`, only the first segment.
 * Idempotent, so the server can normalize a client's value again.
 */
export function normalizeDestination(path: string): string {
  // A leading run of slashes, backslashes, or controls collapses to one `/`,
  // so none of it parses as a host.
  const url = new URL(
    path.replace(/^[\x00-\x20/\\]*/, "/"),
    "https://destination.invalid",
  );
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => (SAFE_SEGMENT.test(segment) ? segment : ":param"));
  const query = new URLSearchParams(
    CONTENT_PARAMS.flatMap((name): [string, string][] => {
      const value = url.searchParams.get(name);
      return value !== null && SAFE_VALUE.test(value) ? [[name, value]] : [];
    }),
  ).toString();
  const destination = `/${segments.join("/")}${query ? `?${query}` : ""}`;
  return destination.length > MAX_DESTINATION_LENGTH
    ? `/${segments[0]}`
    : destination;
}

export type TrackedArrival = {
  trackingId: string;
  destination: string;
  /** The URL to navigate to, without the tracking parameter. */
  url: string;
};

/**
 * The tracked opening `url` represents, or null for an untracked URL. Takes a
 * web URL or an app-scheme one, whose host is the first path segment.
 */
export function trackedArrival(url: string): TrackedArrival | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const trackingId = parsed.searchParams.get(TRACKING_PARAM);
  if (!trackingId || !TRACKING_ID.test(trackingId)) return null;
  parsed.searchParams.delete(TRACKING_PARAM);
  const path =
    parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.pathname
      : `/${parsed.host}${parsed.pathname}`;
  return {
    trackingId,
    destination: normalizeDestination(`${path}${parsed.search}`),
    url: parsed.toString(),
  };
}
