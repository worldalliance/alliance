import {
  getApiUrl as getApiUrlShared,
  getWebSocketUrl as getWebSocketUrlShared,
} from "@alliance/sharedweb/lib/config";

// The panel is served from admin.<domain> and reaches the API at the apex.
// admin.<domain> shares a site with <domain>, so the SameSite=strict auth cookie
// survives that hop — but only to the apex of the domain the panel was loaded
// from. Dev, where the API is on another port, keeps the build-time URL.
const altAppOrigin = (): string | null => {
  const alt = import.meta.env.VITE_ALT_APP_URL;

  if (!alt || typeof window === "undefined") {
    return null;
  }

  const altHost = new URL(alt).hostname;
  const host = window.location.hostname;

  return host === altHost || host.endsWith(`.${altHost}`) ? alt : null;
};

export const getApiUrl = (): string => {
  const alt = altAppOrigin();
  return alt ? `${alt}/api` : getApiUrlShared();
};

export const getWebSocketUrl = (): string => {
  return altAppOrigin() ?? getWebSocketUrlShared(import.meta.env.MODE);
};
