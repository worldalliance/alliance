import { isUploadKey } from "@alliance/common/image-src";
import { NativeModules, Platform } from "react-native";
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

export const getApiUrl = (): string => {
  const visualTestApiUrl = getVisualTestApiUrl();
  if (visualTestApiUrl) {
    return visualTestApiUrl;
  }

  if (__DEV__) {
    return `http://${getDevHost()}:${devApiPort()}`;
  } else {
    return "https://worldalliance.org/api";
  }
};

export const getBaseUrl = (): string => {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/\/api\/?$/, "") || "https://worldalliance.org";
};

export const getImageSource = (string: string) => {
  return `${getApiUrl()}/images/${string}`;
};

export const resolveImageSource = (src: string): string =>
  isUploadKey(src) ? getImageSource(src) : src;

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
