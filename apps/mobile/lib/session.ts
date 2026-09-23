import { R, type Result } from "@alliance/common/result";
import { run } from "@alliance/common/run";
import { TIMED_OUT, withTimeout } from "@alliance/common/timeout";
import {
  authLogin,
  authLogout,
  authMe,
  authRefreshTokens,
  type SessionTokensDto,
  type UserDto,
} from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";
import { milliseconds } from "date-fns";
import { isNetworkFailure, NETWORK_FAILURE_MESSAGE } from "./network";
import type { SessionTokens } from "./SecureStorage";

export class CredentialsRefusedError extends Error {
  constructor() {
    super("The server refused the email and password");
    this.name = "CredentialsRefusedError";
  }
}

export async function requestTokens(credentials: {
  email: string;
  password: string;
  guestToken?: string;
}): Promise<Result<SessionTokensDto, Error>> {
  const sent = await R.fromPromise(
    authLogin({
      body: { ...credentials, mode: "header" },
      throwOnError: false,
    }),
  );
  if (!sent.ok) {
    return sent;
  }
  const { data, error, response } = sent.value;
  // 400 is a malformed email or an empty password.
  if (response.status === 400 || response.status === 401) {
    return R.failure(new CredentialsRefusedError());
  }
  const { access_token, refresh_token } = data ?? {};
  if (!access_token || !refresh_token) {
    return R.failure(new Error("Login failed", { cause: error }));
  }
  return R.success({ access_token, refresh_token });
}

// The profile load after the server issues tokens wraps the fetch error in `cause`.
export function passwordLoginFailure(error: unknown): {
  message: string;
  report: boolean;
} {
  if (error instanceof CredentialsRefusedError) {
    return { message: "Invalid email or password", report: false };
  }
  if (
    isNetworkFailure(error) ||
    (error instanceof Error && isNetworkFailure(error.cause))
  ) {
    return { message: NETWORK_FAILURE_MESSAGE, report: false };
  }
  return {
    message: "We couldn't log you in. Please try again.",
    report: true,
  };
}

export function setAuthHeader(accessToken: string | undefined): void {
  client.setConfig({
    ...client.getConfig(),
    // setConfig merges headers into the ones already set, and null is how it
    // drops one.
    headers: { Authorization: accessToken ? `Bearer ${accessToken}` : null },
  });
}

const FIRST_SESSION = 1;
// Long enough that a keychain write this slow has hung.
const TOKEN_WRITE_DEADLINE = milliseconds({ seconds: 5 });

let lastSession = FIRST_SESSION;
let session: number | undefined = lastSession;
let tokenWrites: Promise<unknown> = Promise.resolve();
// The last logout's delete, login's save or refresh's save. It runs again once
// a write the deadline gave up on lands, so storage ends up matching the
// session.
let lastTokenWrite: () => Promise<unknown> = async () => {};
const sessionRefusalListeners = new Set<() => void>();

export function subscribeToSessionRefusal(listener: () => void): () => void {
  sessionRefusalListeners.add(listener);
  return () => {
    sessionRefusalListeners.delete(listener);
  };
}

/** Drops the session once the server refuses it, while a member is signed in.
 * Before then restoreSession drops a refused session itself. */
export function dropSessionOnRefusal(params: {
  signedIn: boolean;
  dropSession: () => Promise<void>;
}): (() => void) | undefined {
  if (!params.signedIn) return;
  const unsubscribe = subscribeToSessionRefusal(() => {
    unsubscribe();
    run(params.dropSession);
  });
  return unsubscribe;
}

function reportSessionRefusal(refusedSession: number): void {
  if (refusedSession !== session) return;
  sessionRefusalListeners.forEach((listener) => listener());
}

/** The session a request goes out under, for handing to refreshSession.
 * Undefined from logout, or from the start of a login, until a login saves its
 * tokens. */
export function currentSession(): number | undefined {
  return session;
}

/** Runs `write` once every token write queued before it has settled, or has
 * run past the deadline. Each write reads the session in the same turn as it
 * writes, so a logout's delete, a login's save and a refresh's save can't land
 * over one another. */
function queueTokenWrite<T>(write: () => Promise<T>): Promise<T> {
  const ran = tokenWrites.then(write);
  const settled = ran.then(
    () => {},
    () => {},
  );
  // A keychain write that never settles would otherwise hold every write
  // behind it forever.
  tokenWrites = tokenWrites.then(async () => {
    const waited = await withTimeout(settled, TOKEN_WRITE_DEADLINE);
    if (waited !== TIMED_OUT) return;
    void settled
      .then(() => queueTokenWrite(() => lastTokenWrite()))
      .catch((error) => console.error("failed to rewrite the tokens", error));
  });
  return ran;
}

/**
 * Test-only. Puts the session back in the state the module starts a process in.
 *
 * @internal
 */
export function __resetSessionForTests(): void {
  if (!__DEV__) {
    throw new Error("__resetSessionForTests called outside of tests");
  }
  lastSession = FIRST_SESSION;
  session = lastSession;
  tokenWrites = Promise.resolve();
  lastTokenWrite = async () => {};
  sessionRefusalListeners.clear();
}

/** Saves and sets a refreshed token, unless the session it was refreshed for
 * has closed since. Resolves to whether it did. */
export function applyRefresh(params: {
  session: number;
  accessToken: string;
  saveTokens: () => Promise<void>;
}): Promise<boolean> {
  return queueTokenWrite(async () => {
    if (params.session !== session) {
      return false;
    }
    await params.saveTokens();
    // Logout and login close the session without waiting for the queue.
    if (params.session !== session) {
      return false;
    }
    lastTokenWrite = params.saveTokens;
    setAuthHeader(params.accessToken);
    return true;
  });
}

/** Deletes the stored tokens unless a session is open, since the tokens stored
 * then are that session's. */
export function clearClosedSessionTokens(
  clearTokens: () => Promise<Result<void, Error>>,
): Promise<Result<void, Error>> {
  return queueTokenWrite(async () => {
    if (session !== undefined) {
      return R.success(undefined);
    }
    lastTokenWrite = clearTokens;
    return await clearTokens();
  });
}

export async function closeSession(
  clearTokens: () => Promise<Result<void, Error>>,
): Promise<Result<void, Error>> {
  session = undefined;
  // The server attributes the logout to the token this request carries, which
  // the client reads when the call starts.
  authLogout().catch((error) => console.error("logout request failed", error));
  setAuthHeader(undefined);
  return await clearClosedSessionTokens(clearTokens);
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

/** Refreshes the tokens of `session` and resolves to the new access token,
 * having saved it and put it on the client. Resolves to no token when none is
 * stored, the server refuses the one that is, or the session closed
 * meanwhile. A missing or refused token for the current session also notifies
 * subscribeToSessionRefusal listeners. */
export async function refreshSession(
  params: RefreshDeps & { session: number },
): Promise<Result<string | undefined, Error>> {
  const refreshToken = await R.fromPromise(params.getRefreshToken());
  if (!refreshToken.ok) return refreshToken;
  if (!refreshToken.value) {
    reportSessionRefusal(params.session);
    return R.success(undefined);
  }

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
  if (response.status === 401) {
    reportSessionRefusal(params.session);
    return R.success(undefined);
  }
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

  const applied = await R.fromPromiseFn(() =>
    applyRefresh({
      session: params.session,
      accessToken: access_token,
      saveTokens: () =>
        params.saveTokens({ access: access_token, refresh: refresh_token }),
    }),
  );
  return R.map(applied, (didApply) => (didApply ? access_token : undefined));
}

/** Refreshes whatever session is open. Resolves to no token while none is,
 * so a refresh started after logout never reaches the server. */
export async function refreshOpenSession(
  deps: RefreshDeps,
): Promise<Result<string | undefined, Error>> {
  const session = currentSession();
  return session === undefined
    ? R.success(undefined)
    : await refreshSession({ session, ...deps });
}

/** Wraps `fetch` so a request the server answers with 401 is retried once
 * with refreshed tokens. A refresh the server refuses leaves the original 401;
 * any other refresh failure throws. */
export function refreshingFetch(
  params: RefreshDeps & { fetch: (request: Request) => Promise<Response> },
): (request: Request) => Promise<Response> {
  return async (req) => {
    const retryReq = req.clone();
    const sentIn = currentSession();
    const res = await params.fetch(req);

    if (res.status !== 401 || req.url.includes("auth/refresh")) {
      return res;
    }
    if (sentIn === undefined || sentIn !== currentSession()) return res;

    const accessToken = R.unwrap(
      await refreshSession({
        session: sentIn,
        getRefreshToken: params.getRefreshToken,
        saveTokens: params.saveTokens,
      }),
    );
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

export class SessionOvertakenError extends Error {
  constructor() {
    super("A login or logout changed the session while it loaded");
    this.name = "SessionOvertakenError";
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
 * no token is stored or the server refuses the session, which it then drops.
 * Any other failure keeps the tokens for the next try. Fails with
 * SessionOvertakenError, leaving the session alone, once a login or logout
 * starts while it loads. */
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
  const restoring = currentSession();
  const overtaken = () => currentSession() !== restoring;
  const accessToken = await R.fromPromise(params.getAccessToken());
  if (overtaken()) {
    return R.failure(new SessionOvertakenError());
  }
  if (!accessToken.ok) {
    fail(accessToken.error);
    return accessToken;
  }
  if (accessToken.value) {
    setAuthHeader(accessToken.value);
  } else {
    const refreshToken = await R.fromPromise(params.getRefreshToken());
    if (overtaken()) {
      return R.failure(new SessionOvertakenError());
    }
    if (!refreshToken.ok) {
      fail(refreshToken.error);
      return refreshToken;
    }
    if (!refreshToken.value) {
      return R.success(undefined);
    }
  }
  const loaded = await loadSessionUser();
  if (overtaken()) {
    return R.failure(new SessionOvertakenError());
  }
  if (loaded.ok) {
    return loaded;
  }
  if (loaded.error instanceof SessionRefusedError) {
    await params.dropSession();
    return R.success(undefined);
  }
  fail(loaded.error);
  return loaded;
}

export async function openSession(params: {
  tokens: SessionTokensDto;
  saveTokens: (tokens: SessionTokens) => Promise<void>;
  clearTokens: () => Promise<Result<void, Error>>;
}): Promise<Result<UserDto, Error>> {
  const { tokens } = params;
  setAuthHeader(tokens.access_token);
  // The login replaces whatever session was open, so closing it here keeps the
  // profile call below from refreshing with the tokens that one left stored.
  session = undefined;

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
  const saved = await queueTokenWrite(async () => {
    const saveTokens = () =>
      params.saveTokens({
        access: tokens.access_token,
        refresh: tokens.refresh_token,
      });
    const saved = await R.fromPromise(saveTokens());
    if (saved.ok) {
      session = ++lastSession;
      lastTokenWrite = saveTokens;
    }
    return saved;
  });
  if (!saved.ok) {
    setAuthHeader(undefined);
    // The access token can land without the refresh token.
    const cleared = await clearClosedSessionTokens(params.clearTokens);
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
