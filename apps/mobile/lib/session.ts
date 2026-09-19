import { R, type Result } from "@alliance/common/result";
import {
  authLogout,
  authMe,
  authRefreshTokens,
  type SessionTokensDto,
  type UserDto,
} from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";

export type SessionTokens = { access: string; refresh: string | undefined };

export function setAuthHeader(accessToken: string | undefined): void {
  client.setConfig({
    ...client.getConfig(),
    // setConfig merges headers into the ones already set, and null is how it
    // drops one.
    headers: { Authorization: accessToken ? `Bearer ${accessToken}` : null },
  });
}

export async function closeSession(
  clearTokens: () => Promise<Result<void, Error>>,
): Promise<Result<void, Error>> {
  // The server attributes the logout to the token this request carries, which
  // the client reads when the call starts.
  authLogout().catch((error) => console.error("logout request failed", error));
  setAuthHeader(undefined);
  return await clearTokens();
}

export async function clearStoredTokens<Key extends string>(
  storage: {
    deleteItem: (key: Key) => Promise<void>;
    getItem: (key: Key) => Promise<string | null>;
  },
  keys: Key[],
): Promise<Result<void, Error>> {
  const left = await R.fromPromiseFn(async () => {
    await Promise.all(keys.map((key) => storage.deleteItem(key)));
    // expo-secure-store's iOS delete resolves without checking whether the
    // keychain removed the item.
    return await Promise.all(keys.map((key) => storage.getItem(key)));
  });
  if (!left.ok) {
    return left;
  }
  const stored = keys.filter((_key, i) => left.value[i] !== null);
  return stored.length === 0
    ? R.success(undefined)
    : R.failure(
        new Error(
          `session tokens still stored after the delete: ${stored.join(", ")}`,
        ),
      );
}

export async function retryClearTokens(params: {
  clearTokens: () => Promise<Result<void, Error>>;
  askToRetry: () => Promise<boolean>;
}): Promise<void> {
  while (await params.askToRetry()) {
    if ((await params.clearTokens()).ok) {
      return;
    }
  }
}

/** Wraps `fetch` so a request the server answers with 401 is retried once
 * with refreshed tokens. */
export function refreshingFetch(params: {
  fetch: (request: Request) => Promise<Response>;
  getRefreshToken: () => Promise<string | null>;
  saveTokens: (tokens: SessionTokens) => Promise<void>;
}): (request: Request) => Promise<Response> {
  return async (req) => {
    const retryReq = req.clone();
    const res = await params.fetch(req);

    if (res.status !== 401 || req.url.includes("auth/refresh")) {
      return res;
    }

    const refreshToken = await params.getRefreshToken();
    if (!refreshToken) return res;

    const refreshRes = await authRefreshTokens({
      query: { mode: "header" },
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    if (!refreshRes.response.ok || !refreshRes.data?.access_token) {
      return res;
    }

    const { access_token, refresh_token } = refreshRes.data;
    await params.saveTokens({ access: access_token, refresh: refresh_token });
    setAuthHeader(access_token);
    const retryHeaders = new Headers(retryReq.headers);
    retryHeaders.set("Authorization", `Bearer ${access_token}`);
    return params.fetch(new Request(retryReq, { headers: retryHeaders }));
  };
}

export async function openSession(params: {
  tokens: SessionTokensDto;
  saveTokens: (tokens: SessionTokens) => Promise<void>;
  clearTokens: () => Promise<Result<void, Error>>;
}): Promise<Result<UserDto, Error>> {
  const { tokens } = params;
  setAuthHeader(tokens.access_token);

  const profile = await R.fromPromise(authMe());
  const user = profile.ok ? profile.value.data?.user : undefined;
  if (!user) {
    setAuthHeader(undefined);
    return R.failure(
      new Error("Failed to fetch user profile", {
        cause: profile.ok ? undefined : profile.error,
      }),
    );
  }

  // Tokens saved before the profile loads outlive a sign-in the member was
  // told had failed, and sign them in on the next launch.
  const saved = await R.fromPromise(
    params.saveTokens({
      access: tokens.access_token,
      refresh: tokens.refresh_token,
    }),
  );
  if (!saved.ok) {
    setAuthHeader(undefined);
    // The access token can land without the refresh token.
    const cleared = await params.clearTokens();
    return R.failure(
      cleared.ok
        ? saved.error
        : new AggregateError(
            [saved.error, cleared.error],
            "Failed to save session tokens, then to clear them",
          ),
    );
  }
  return R.success(user);
}
