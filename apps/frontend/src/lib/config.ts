export const getApiUrl = (): string => {
  if (import.meta.env.REACT_APP_API_URL) {
    return import.meta.env.REACT_APP_API_URL;
  }

  if (import.meta.env.MODE === "development") {
    return "http://localhost:3005";
  } else {
    return window.location.protocol + "//alliance-beta.xyz/api";
  }
};

export const getImageSource = (string: string) => {
  return `${getApiUrl()}/images/${string}`;
};
