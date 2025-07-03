export const prod_api_url = "https://worldalliance.org/api";

export const getWebSocketUrl = (mode: string): string => {
  if (mode === "development") {
    return "http://localhost:3005";
  } else {
    return "https://worldalliance.org";
  }
};
