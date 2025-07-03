export const base_url = "https://worldalliance.org";
export const prod_api_url = base_url + "/api";

export const getWebSocketUrl = (mode: string): string => {
  if (mode === "development") {
    return "http://localhost:3005";
  } else {
    return base_url;
  }
};
