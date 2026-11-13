import type { DevUrl } from "@alliance/common/dev-ports";
import { adminOrigin, preferNewDomain } from "@alliance/common/url";
import { requireWebEnv, webEnv } from "./env";

const mode = import.meta.env.MODE;

const prodUrl = (): string => requireWebEnv("VITE_API_URL");

// A missing value must fail rather than send a worktree to the main database.
const devUrl = (name: `${DevUrl}`): string => {
  const url = webEnv(name);

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
    return prodUrl();
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
    return prodUrl();
  }
};

export const getAdminUrl = (): string =>
  mode === "development"
    ? devUrl("ALLIANCE_DEV_ADMIN_URL")
    : adminOrigin(prodUrl());

export const getInviteBaseUrl = (): string =>
  preferNewDomain([webEnv("VITE_ALT_APP_URL"), getBaseUrl()]) ?? getBaseUrl();

export const getApiUrl = (): string => {
  if (mode === "development") {
    return devUrl("ALLIANCE_DEV_API_URL");
  } else {
    return prodUrl() + "/api";
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
