import { prod_api_url } from "@alliance/shared/lib/config";

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

export const getImageSource = (string: string) => {
  return `${getApiUrl()}/images/${string}`;
};
