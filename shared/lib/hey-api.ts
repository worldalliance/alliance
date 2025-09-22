import { authRefreshTokens } from "../client";
import { CreateClientConfig } from "../client/client.gen";
import { getApiUrl } from "./config";

export const AuthEvents = {
  onUnauthorized: () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
  },
};

export const createClientConfig: CreateClientConfig = (config) => {
  const originalFetch = (config?.fetch ?? fetch).bind(globalThis);

  const wrappedFetch: typeof fetch = async (input: RequestInfo | URL) => {
    const inputreq = input as Request;
    const res = await originalFetch(new Request(input).clone());

    if (
      res.status !== 401 ||
      inputreq.url.includes("auth/refresh") ||
      window.location.pathname.includes("/login") ||
      window.location.pathname.includes("/signup")
    )
      return res;

    const refreshRes = await authRefreshTokens();

    if (refreshRes.response.ok) {
      const retryRes = await originalFetch(inputreq.clone());
      if (retryRes.status !== 401) {
        return retryRes;
      } else {
        console.log(retryRes);
      }
    }

    AuthEvents.onUnauthorized();
    return res;
  };

  const baseUrl = getApiUrl();

  return {
    baseUrl,
    credentials: "include",
    fetch: wrappedFetch,
    throwOnError: false,
  };
};
