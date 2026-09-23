import { CreateClientConfig } from "../client/client.gen";

const isReactNative = (): boolean =>
  typeof navigator !== "undefined" && navigator.product === "ReactNative";

export const AuthEvents = {
  onUnauthorized: () => {
    if (isReactNative()) {
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
  },
};

export const createClientConfig: CreateClientConfig = (config) => {
  const originalFetch = (config?.fetch ?? fetch).bind(globalThis);

  const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const retryReq = req.clone();

    const res = await originalFetch(req);

    if (
      res.status !== 401 ||
      req.url.includes("auth/refresh") ||
      window?.location?.pathname?.includes("/login") ||
      window?.location?.pathname?.includes("/signup")
    ) {
      return res;
    }

    const { authRefreshTokens } = await import("../client/sdk.gen");
    const refreshRes = await authRefreshTokens();

    if (refreshRes.response.ok) {
      const retryRes = await originalFetch(retryReq);
      if (retryRes.status !== 401) {
        return retryRes;
      } else {
        console.error(retryRes);
      }
    }
    AuthEvents.onUnauthorized();

    return res;
  };
  const baseUrl = config?.baseUrl;

  return {
    baseUrl,
    // The app authenticates by header and keeps its tokens in secure storage. A
    // cookie it still carries would sign it in besides, as a session it can
    // neither see nor end.
    credentials: isReactNative() ? "omit" : "include",
    fetch: wrappedFetch,
    throwOnError: false,
  };
};
