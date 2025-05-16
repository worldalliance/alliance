import { prod_api_url } from "@alliance/shared/lib/config";
import localhost from "react-native-localhost";

export const getApiUrl = (): string => {
  if (__DEV__) {
    return "http://" + localhost + ":3005";
  } else {
    return prod_api_url;
  }
};

export const getImageSource = (string: string) => {
  return `${getApiUrl()}/images/${string}`;
};
