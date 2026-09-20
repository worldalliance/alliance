import { R, type Result } from "@alliance/common/result";
import {
  authLogout,
  authMe,
  authRefreshTokens,
  type SessionTokensDto,
  type UserDto,
} from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";
import { isNetworkFailure } from "./network";
import type { SessionTokens } from "./SecureStorage";

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

type RefreshDeps = {
  getRefreshToken: () => Promise<string | null>;
  saveTokens: (tokens: SessionTokens) => Promise<void>;
};

/** Refreshes the stored tokens, saves them and puts the new access token on
 * the client, then resolves to it. Resolves to no token when none is stored
 * and when the server refuses the one that is. */
export async function refreshSession(
  params: RefreshDeps,
): Promise<Result<string | undefined, Error>> {
  const refreshToken = await R.fromPromise(params.getRefreshToken());
  if (!refreshToken.ok) return refreshToken;
  if (!refreshToken.value) return R.success(undefined);

  const sent = await R.fromPromise(
    authRefreshTokens({
      query: { mode: "header" },
      // setAuthHeader leaves the access token on the client, and this endpoint
      // authenticates with the refresh token.
      headers: { Authorization: `Bearer ${refreshToken.value}` }, //TODO: mobile shouldnt have to manually set this - fix non-cookie mode somehow. or maybe use auth context?
      throwOnError: false,
    }),
  );
  if (!sent.ok) return sent;

  const { data, response } = sent.value;
  if (response.status === 401) return R.success(undefined);
  if (!response.ok) {
    return R.failure(new Error(`token refresh failed: ${response.status}`));
  }
  const { access_token, refresh_token } = data ?? {};
  // Header mode answers with both or neither.
  if (!access_token || !refresh_token) {
    return R.failure(
      new Error(
        `token refresh answered ${response.status} without both tokens`,
      ),
    );
  }

  const saved = await R.fromPromise(
    params.saveTokens({ access: access_token, refresh: refresh_token }),
  );
  if (!saved.ok) return saved;
  setAuthHeader(access_token);
  return R.success(access_token);
}

/** Wraps `fetch` so a request the server answers with 401 is retried once
 * with refreshed tokens. A refresh the server refuses leaves the original 401;
 * any other refresh failure throws. */
export function refreshingFetch(
  params: RefreshDeps & { fetch: (request: Request) => Promise<Response> },
): (request: Request) => Promise<Response> {
  return async (req) => {
    const retryReq = req.clone();
    const res = await params.fetch(req);

    if (res.status !== 401 || req.url.includes("auth/refresh")) {
      return res;
    }

    const accessToken = R.unwrap(await refreshSession(params));
    if (!accessToken) return res;
    const retryHeaders = new Headers(retryReq.headers);
    retryHeaders.set("Authorization", `Bearer ${accessToken}`);
    return params.fetch(new Request(retryReq, { headers: retryHeaders }));
  };
}

export class SessionRefusedError extends Error {
  constructor() {
    super("The server refused the stored session");
    this.name = "SessionRefusedError";
  }
}

export async function loadSessionUser(): Promise<Result<UserDto, Error>> {
  const sent = await R.fromPromise(authMe({ throwOnError: false }));
  if (!sent.ok) {
    return sent;
  }
  const { data, response } = sent.value;
  if (response.status === 401) {
    return R.failure(new SessionRefusedError());
  }
  return data?.user
    ? R.success(data.user)
    : R.failure(new Error(`Failed to load the session: ${response.status}`));
}

/** Loads the stored session's member at launch, resolving to no member when
 * no token is stored. Drops the session only when the server refuses it; any
 * other failure keeps the tokens for the next try. */
export async function restoreSession(params: {
  getAccessToken: () => Promise<string | null>;
  getRefreshToken: () => Promise<string | null>;
  dropSession: () => Promise<void>;
  reportFailure: (error: Error) => void;
}): Promise<Result<UserDto | undefined, Error>> {
  const fail = (error: Error) => {
    console.error("failed to load the session at launch", error);
    if (!isNetworkFailure(error)) {
      params.reportFailure(error);
    }
  };
  const accessToken = await R.fromPromise(params.getAccessToken());
  if (!accessToken.ok) {
    fail(accessToken.error);
    return accessToken;
  }
  if (accessToken.value) {
    setAuthHeader(accessToken.value);
  } else {
    const refreshToken = await R.fromPromise(params.getRefreshToken());
    if (!refreshToken.ok) {
      fail(refreshToken.error);
      return refreshToken;
    }
    if (!refreshToken.value) {
      return R.success(undefined);
    }
  }
  const loaded = await loadSessionUser();
  if (loaded.ok) {
    return loaded;
  }
  if (loaded.error instanceof SessionRefusedError) {
    await params.dropSession();
  } else {
    fail(loaded.error);
  }
  return loaded;
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
