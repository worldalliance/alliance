type ViteEnv = {
  MODE: string;
  VITE_API_URL: string;
  VITE_ALT_APP_URL?: string;
  // Vite configs inject these without the VITE_ prefix so `.env` files cannot
  // override them.
  ALLIANCE_DEV_API_URL?: string;
  ALLIANCE_DEV_APP_URL?: string;
};

const env = (import.meta as unknown as { env: ViteEnv }).env;

const mode = env.MODE;

const prod_url = env.VITE_API_URL;

// A missing value must fail rather than send a worktree to the main database.
// Read lazily because this module is also imported outside Vite.
const devUrl = (
  name: "ALLIANCE_DEV_API_URL" | "ALLIANCE_DEV_APP_URL",
): string => {
  const url = env[name];

  if (!url) {
    throw new Error(
      `${name} is unset — the vite configs inject it from common/src/dev-ports.ts, so this bundle was not built by one of them`,
    );
  }

  return url;
};

export const getWebSocketUrl = (mode: string): string => {
  if (mode === "development") {
    return devUrl("ALLIANCE_DEV_API_URL");
  } else {
    return prod_url;
  }
};

export const isProduction = (): boolean => {
  return mode === "production";
};

export const isStaging = (): boolean => {
  return mode === "staging";
};

export const getBaseUrl = (): string => {
  if (mode === "development") {
    return devUrl("ALLIANCE_DEV_APP_URL");
  } else {
    return prod_url;
  }
};

export const getInviteBaseUrl = (): string =>
  env.VITE_ALT_APP_URL || getBaseUrl();

export const memberProfileUrl = (id: number | string): string =>
  `${getBaseUrl()}/member/${id}`;

export const getApiUrl = (): string => {
  if (mode === "development") {
    return devUrl("ALLIANCE_DEV_API_URL");
  } else {
    return prod_url + "/api";
  }
};

export const sharp_allowed_mime_types = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg",
  "image/tiff",
];
