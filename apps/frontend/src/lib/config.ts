import { Features, isEnabled } from "@alliance/shared/lib/features";
import {
  getApiUrl as getApiUrlShared,
  getWebSocketUrl as getWebSocketUrlShared,
} from "@alliance/sharedweb/lib/config";

// One vhost serves this app on both worldalliance.org and thealliance.org and
// proxies /api and /socket.io on each. The auth cookie is SameSite=strict, so a
// call aimed at the domain the user did not load carries no cookie. SSR has no
// location and the dev server's API is on another port, so both keep the
// build-time URL.
const browserOrigin = (): string | null =>
  typeof window !== "undefined" && import.meta.env.MODE !== "development"
    ? window.location.origin
    : null;

export const getApiUrl = (): string => {
  const origin = browserOrigin();
  return origin ? `${origin}/api` : getApiUrlShared();
};

export const getWebSocketUrl = (): string => {
  return browserOrigin() ?? getWebSocketUrlShared(import.meta.env.MODE);
};

/**
 * PostHog is reverse-proxied at a path on whichever domain serves the app, so
 * only the origin of the configured host is wrong on the alt domain.
 */
export const getPosthogHost = (): string | undefined => {
  const configured = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
  const origin = browserOrigin();
  return origin && configured
    ? `${origin}${new URL(configured).pathname}`
    : configured;
};

export const getSingleActionSSEUrl = (actionId: number) => {
  return `${getApiUrl()}/actions/live/${actionId}`;
};

export const getBulkActionSSEUrl = (actionIds: number[]) => {
  return `${getApiUrl()}/actions/live-list?ids=${actionIds.join(",")}`;
};

export const isFeatureEnabled = (feature: Features) => {
  return isEnabled(feature, import.meta.env.MODE);
};
