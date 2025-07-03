import { prod_api_url } from "@alliance/shared/lib/config";
import { Features, isEnabled } from "@alliance/shared/lib/features";

export const getApiUrl = (): string => {
  if (import.meta.env.MODE === "development") {
    return "http://localhost:3005";
  } else {
    return prod_api_url;
  }
};

export const getWebSocketUrl = (): string => {
  if (import.meta.env.MODE === "development") {
    return "http://localhost:3005";
  } else {
    return "https://worldalliance.org";
  }
};

export const getSingleActionSSEUrl = (actionId: number) => {
  return `${getApiUrl()}/actions/live/${actionId}`;
};

export const getBulkActionSSEUrl = (actionIds: number[]) => {
  return `${getApiUrl()}/actions/live-list?ids=${actionIds.join(",")}`;
};

export const getImageSource = (string: string) => {
  if (import.meta.env.STORYBOOK) {
    return string;
  }
  return `${getApiUrl()}/images/${string}`;
};

export const isFeatureEnabled = (feature: Features) => {
  return isEnabled(feature, import.meta.env.MODE);
};
