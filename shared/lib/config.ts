export const base_url = "https://worldalliance.org";
export const prod_api_url = base_url + "/api";

export const getWebSocketUrl = (mode: string): string => {
  if (mode === "development") {
    return "http://localhost:3005";
  } else {
    return base_url;
  }
};

export const getApiUrl = (): string => {
  if (
    (import.meta as unknown as { env: { MODE: string } }).env.MODE ===
    "development"
  ) {
    return "http://localhost:3005";
  } else {
    return prod_api_url;
  }
};

export const sharp_allowed_mime_types = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg",
  "image/tiff",
];
