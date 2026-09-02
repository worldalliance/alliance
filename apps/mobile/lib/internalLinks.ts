import { isAllianceAppHostname } from "@alliance/common/url";

/**
 * Route patterns that can be handled internally by the mobile app.
 * Each pattern is a regex that matches a relative URL path.
 * Use capturing groups to extract route parameters.
 */
const INTERNAL_ROUTE_PATTERNS: {
  pattern: RegExp;
  getRoute: (match: RegExpMatchArray) => string;
}[] = [
  // Action activity detail: /actions/123/activity/456
  {
    pattern: /^\/actions?\/(\d+)\/activity\/(\d+)\/?$/,
    getRoute: (match) => `/actions/${match[1]}/activity/${match[2]}`,
  },
  // Action pages: /actions/123 or /action/123
  {
    pattern: /^\/actions?\/(\d+)\/?$/,
    getRoute: (match) => `/actions/${match[1]}`,
  },
  // Actions list: /actions
  {
    pattern: /^\/actions\/?$/,
    getRoute: () => "/actions",
  },
  // Forum index: /forum
  {
    pattern: /^\/forum\/?$/,
    getRoute: () => "/forum",
  },
  // Forum post: /forum/post/123 or /forum/123
  {
    pattern: /^\/forum\/(?:post\/)?(\d+)\/?$/,
    getRoute: (match) => `/forum/post/${match[1]}`,
  },
  // Member profile: /member/123
  {
    pattern: /^\/member\/(\d+)\/?$/,
    getRoute: (match) => `/member/${match[1]}`,
  },
  // Messages list: /messages
  {
    pattern: /^\/messages\/?$/,
    getRoute: () => "/messages",
  },
  // Activity feed: /feed
  {
    pattern: /^\/feed\/?$/,
    getRoute: () => "/feed",
  },
  // One action's activity feed: /feed/123
  {
    pattern: /^\/feed\/(\d+)\/?$/,
    getRoute: (match) => `/actions/${match[1]}?tab=activity`,
  },
  // User profile: /profile
  {
    pattern: /^\/profile\/?$/,
    getRoute: () => "/profile",
  },
  // Settings: /settings
  {
    pattern: /^\/settings\/?$/,
    getRoute: () => "/settings",
  },
  // Notifications: /notifications
  {
    pattern: /^\/notifications\/?$/,
    getRoute: () => "/notifications",
  },
  // Membership: /membership or /contract
  {
    pattern: /^\/(?:membership|contract)\/?$/,
    getRoute: () => "/membership",
  },
  // Groups: /groups
  {
    pattern: /^\/groups\/?$/,
    getRoute: () => "/groups",
  },
  // Invites: /invites
  {
    pattern: /^\/invites\/?$/,
    getRoute: () => "/invites",
  },
  // Information: /information
  {
    pattern: /^\/information\/?$/,
    getRoute: () => "/information",
  },
  // Search: /search
  {
    pattern: /^\/search\/?$/,
    getRoute: () => "/search",
  },
];

/**
 * Check if a URL is a relative path that can be handled internally
 */
export function getInternalRoute(url: string): string | null {
  // Only process relative URLs (starting with /)
  if (!url.startsWith("/")) {
    return null;
  }

  // Extract query string and hash to preserve them
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");
  const suffixStart =
    queryIndex >= 0 && hashIndex >= 0
      ? Math.min(queryIndex, hashIndex)
      : queryIndex >= 0
        ? queryIndex
        : hashIndex;
  const pathOnly = suffixStart >= 0 ? url.slice(0, suffixStart) : url;
  const suffix = suffixStart >= 0 ? url.slice(suffixStart) : "";

  for (const { pattern, getRoute } of INTERNAL_ROUTE_PATTERNS) {
    const match = pathOnly.match(pattern);
    if (match) {
      const route = getRoute(match);
      if (route.includes("?") && suffix.startsWith("?")) {
        return `${route}&${suffix.slice(1)}`;
      }
      return route + suffix;
    }
  }

  return null;
}

/**
 * The path to route on when a URL points at our own site on either domain,
 * or null when the URL belongs in the browser.
 */
export function extractPathFromInternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      isAllianceAppHostname(parsed.hostname)
    ) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    return null;
  }
  return null;
}
