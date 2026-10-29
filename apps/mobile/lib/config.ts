import { resolveUploadSrc, uploadSrc } from "@alliance/common/image-src";
import { R } from "@alliance/common/result";
import { client } from "@alliance/shared/client/client.gen";
import * as Application from "expo-application";
import { NativeModules, Platform } from "react-native";
import { type ReleaseTarget, releaseTargetFor, STAGING } from "./releaseTarget";
import { getVisualTestApiUrl } from "./visualTest";

// Keep this out of app.config.js `extra`, which changes the EAS fingerprint and
// OTA runtimeVersion. A missing value must fail rather than send a worktree to
// the main checkout's database.
const devApiPort = (): number => {
  const raw = process.env.EXPO_PUBLIC_ALLIANCE_API_PORT;
  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `EXPO_PUBLIC_ALLIANCE_API_PORT=${raw ?? "<unset>"} is not a port — start the app with \`bun run --cwd apps/mobile start\` (or web/ios/android), which resolves it for this checkout`,
    );
  }

  return port;
};

const getDevHost = (): string => {
  if (Platform.OS === "web") {
    return window.location.hostname;
  }
  const url = NativeModules.SourceCode?.getConstants().scriptURL;
  const ip = !!url ? url.split(":")[1].substring(2) : undefined;
  return ip ?? process.env.EXPO_PUBLIC_DEV_API_URL ?? "localhost";
};

/** The deployment a release build talks to, fixed by its bundle ID or package. */
export const releaseTarget = (): ReleaseTarget =>
  R.unwrap(releaseTargetFor(Application.applicationId));

let reviewSession = false;

/** An app-store review account's session runs against staging, whichever
 * deployment the binary targets. */
export const setReviewSession = (review: boolean): void => {
  reviewSession = review;
  client.setConfig({ baseUrl: getApiUrl() });
};

export const isReviewSession = (): boolean => reviewSession;

export const getApiUrl = (): string =>
  reviewSession ? STAGING.apiUrl : getBinaryApiUrl();

export const getBinaryApiUrl = (): string => {
  const visualTestApiUrl = getVisualTestApiUrl();
  if (visualTestApiUrl) {
    return visualTestApiUrl;
  }

  if (__DEV__) {
    return `http://${getDevHost()}:${devApiPort()}`;
  } else {
    return releaseTarget().apiUrl;
  }
};

export const getBaseUrl = (): string => {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/\/api\/?$/, "") || "https://worldalliance.org";
};

/**
 * Where links shared off the app or opened in a browser point: staging's web
 * app in a review session, else the release target's, or the dev API server's
 * origin under `__DEV__`.
 */
export const getSiteUrl = (): string =>
  reviewSession
    ? STAGING.siteUrl
    : __DEV__
      ? getBaseUrl()
      : releaseTarget().siteUrl;

export const getSitePageUrl = (path: string): string =>
  `${getSiteUrl()}${path.startsWith("/") ? "" : "/"}${path}`;

export const getImageSource = (key: string) =>
  uploadSrc({ key, apiUrl: getApiUrl() });

export const resolveImageSource = (src: string): string =>
  resolveUploadSrc({ src, apiUrl: getApiUrl() });

export const getWebSocketUrl = (): string => {
  const baseUrl = getBaseUrl();
  if (baseUrl.startsWith("https://")) {
    return baseUrl.replace("https://", "wss://");
  }
  if (baseUrl.startsWith("http://")) {
    return baseUrl.replace("http://", "ws://");
  }
  return baseUrl;
};

/** The full-screen task flow replaces the inline task form in dev builds started with `EXPO_PUBLIC_TASK_FLOW=1`. */
export const taskFlowEnabled = (): boolean =>
  __DEV__ && process.env.EXPO_PUBLIC_TASK_FLOW === "1";
