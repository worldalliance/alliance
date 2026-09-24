import { refusalMessage } from "@alliance/common/errorMessage";
import type { Client } from "@hey-api/client-fetch";
import { z } from "zod";
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

// Attach the HTTP status because the error body may omit it.
export const registerErrorStatus = (client: Client): void => {
  client.interceptors.error.use((error, response) => ({
    ...(typeof error === "object" && error !== null && !Array.isArray(error)
      ? error
      : { body: error }),
    statusCode: response.status,
  }));
};

const thrownStatusSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
});

/** The status registerErrorStatus put on a thrown error response, or
 * undefined for an error that never reached the server. */
export const thrownStatus = (error: unknown): number | undefined =>
  thrownStatusSchema.safeParse(error).data?.statusCode;

export const thrownRefusalMessage = (params: {
  error: unknown;
  fallback: string;
  sessionExpired: string;
}): string => {
  const status = thrownStatus(params.error);
  if (status === undefined) return params.fallback;
  return refusalMessage({ ...params, status });
};
