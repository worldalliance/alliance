import { prod_api_url } from "../../../../shared/lib/config";
import { Features, isEnabled } from "../../../../shared/lib/features";

export const getApiUrl = (): string => {
  if (import.meta.env.REACT_APP_API_URL) {
    return import.meta.env.REACT_APP_API_URL;
  }

  if (import.meta.env.MODE === "development") {
    return "http://localhost:3005";
  } else {
    return prod_api_url;
  }
};

export const getSingleActionSSEUrl = (actionId: number) => {
  return `${getApiUrl()}/actions/live/${actionId}`;
};

export const getBulkActionSSEUrl = (actionIds: number[]) => {
  return `${getApiUrl()}/actions/live-list?ids=${actionIds.join(",")}`;
};

export const getImageSource = (string: string) => {
  return `${getApiUrl()}/images/${string}`;
};

export const isFeatureEnabled = (feature: Features) => {
  return isEnabled(feature, import.meta.env.MODE);
};
