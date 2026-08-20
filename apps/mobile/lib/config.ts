import { NativeModules, Platform } from "react-native";
import { getVisualTestApiUrl } from "./visualTest";

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
    return "http://" + getDevHost() + ":3005";
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
