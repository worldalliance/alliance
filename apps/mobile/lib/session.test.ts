import { R, type Result } from "@alliance/common/result";
import { authMe } from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";
import {
  routes,
  type RouteTable,
  serveApi,
} from "@alliance/shared/lib/testing/serveApi";
import { afterEach, expect, it, jest, mock, spyOn } from "bun:test";
import { milliseconds } from "date-fns";
import { FetchError } from "expo/src/winter/fetch/FetchErrors";
import { NETWORK_FAILURE_MESSAGE } from "./network";
import type { SessionTokens } from "./SecureStorage";
import {
  __resetSessionForTests,
  applyRefresh,
  clearClosedSessionTokens,
  clearStoredTokens,
  closeSession,
  CredentialsRefusedError,
  currentSession,
  dropSessionOnRefusal,
  loadSessionUser,
  openSession,
  passwordLoginFailure,
  refreshingFetch,
  refreshOpenSession,
  refreshSession,
  requestTokens,
  restoreSession,
  retryClearTokens,
  SessionOvertakenError,
  SessionRefusedError,
  setAuthHeader,
  subscribeToSessionRefusal,
} from "./session";

const api = serveApi(routes({}));

afterEach(() => {
  // A test that logs out leaves the session closed for the next one.
  __resetSessionForTests();
  setAuthHeader(undefined);
  jest.useRealTimers();
  mock.restore();
});

const tokens = { access_token: "access", refresh_token: "refresh" };

const cleared = async (): Promise<Result<void, Error>> => R.success(undefined);

const start = ({
  saveTokens = mock(async (_tokens: SessionTokens) => {}),
  clearTokens = mock(cleared),
} = {}) => {
  return {
    saveTokens,
    clearTokens,
    opened: openSession({ tokens, saveTokens, clearTokens }),
  };
};

const nextAuthorization = async (): Promise<string | null> => {
  let sent: string | null = null;
  api.throwingOnRefusal({
    "GET /auth/me": ({ request }) => {
      sent = request.headers.get("authorization");
      return Response.json({ user: { id: 1 } });
    },
  });
  await authMe();
  return sent;
};

it("saves the tokens once the profile has loaded", async () => {
  const sent = mock();
  api.throwingOnRefusal({
    "GET /auth/me": ({ request }) => {
      sent(request.headers.get("authorization"));
      return Response.json({ user: { id: 7 } });
    },
  });

  const { saveTokens, opened } = start();
  const result = await opened;

  expect(result.ok && result.value.id).toBe(7);
  expect(sent).toHaveBeenCalledWith("Bearer access");
  expect(saveTokens).toHaveBeenCalledWith({
    access: "access",
    refresh: "refresh",
  });
});

it("saves nothing and drops the header when the profile is refused", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => new Response(null, { status: 401 }),
  });

  const { saveTokens, opened } = start();

  expect((await opened).ok).toBe(false);
  expect(saveTokens).not.toHaveBeenCalled();
  expect(await nextAuthorization()).toBeNull();
});

it("saves nothing when the request never gets a response", async () => {
  const unreachable = new Error("fetch failed");
  api.throwingOnRefusal({
    "GET /auth/me": () => {
      throw unreachable;
    },
  });

  const { saveTokens, opened } = start();
  const result = await opened;

  expect(result.ok ? undefined : result.error.cause).toBe(unreachable);
  expect(saveTokens).not.toHaveBeenCalled();
  expect(await nextAuthorization()).toBeNull();
});

it("clears the tokens and drops the header when saving them fails", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => Response.json({ user: { id: 7 } }),
  });
  const keychain = new Error("keychain");

  const { clearTokens, opened } = start({
    saveTokens: mock(async () => {
      throw keychain;
    }),
  });
  const result = await opened;

  expect(result.ok ? undefined : result.error).toBe(keychain);
  expect(clearTokens).toHaveBeenCalled();
  expect(await nextAuthorization()).toBeNull();
});

it("reports both failures when clearing the tokens fails too", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => Response.json({ user: { id: 7 } }),
  });
  const keychain = new Error("keychain");
  const keychainDelete = new Error("keychain delete");

  const { opened } = start({
    saveTokens: mock(async () => {
      throw keychain;
    }),
    clearTokens: mock(async () => R.failure(keychainDelete)),
  });
  const result = await opened;

  const error = result.ok ? undefined : result.error;
  expect(error).toBeInstanceOf(AggregateError);
  expect(error instanceof AggregateError && error.errors).toEqual([
    keychain,
    keychainDelete,
  ]);
  expect(await nextAuthorization()).toBeNull();
});

it("sends the logout with the token, then drops it", async () => {
  const logout = Promise.withResolvers<string | null>();
  api.throwingOnRefusal({
    "POST /auth/logout": ({ request }) => {
      logout.resolve(request.headers.get("authorization"));
      return new Response(null, { status: 200 });
    },
  });
  setAuthHeader("access");
  const clearTokens = mock(cleared);

  const closed = await closeSession(clearTokens);

  expect(closed.ok).toBe(true);
  expect(await logout.promise).toBe("Bearer access");
  expect(clearTokens).toHaveBeenCalled();
  expect(await nextAuthorization()).toBeNull();
});

it("reports a failure to clear the tokens", async () => {
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
  });
  setAuthHeader("access");
  const keychainDelete = new Error("keychain delete");

  const closed = await closeSession(async () => R.failure(keychainDelete));

  expect(closed.ok ? undefined : closed.error).toBe(keychainDelete);
  expect(await nextAuthorization()).toBeNull();
});

it("closes the session when the logout request fails", async () => {
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 500 }),
  });
  setAuthHeader("access");

  const closed = await closeSession(cleared);

  expect(closed.ok).toBe(true);
  expect(await nextAuthorization()).toBeNull();
});

const storage = ({ deletes }: { deletes: boolean }) => {
  const items = new Map([
    ["access", "a"],
    ["refresh", "r"],
  ]);
  return {
    items,
    deleteItem: async (key: string) => {
      if (deletes) {
        items.delete(key);
      }
    },
    getItem: async (key: string) => items.get(key) ?? null,
  };
};

it("clears the stored tokens", async () => {
  const stored = storage({ deletes: true });

  const result = await clearStoredTokens(stored, ["access", "refresh"]);

  expect(result.ok).toBe(true);
  expect(stored.items.size).toBe(0);
});

it("reports a delete that resolves but leaves the tokens stored", async () => {
  const result = await clearStoredTokens(storage({ deletes: false }), [
    "access",
    "refresh",
  ]);

  expect(result.ok).toBe(false);
});

it("names the tokens a delete leaves stored", async () => {
  const stored = storage({ deletes: true });

  const result = await clearStoredTokens(
    {
      ...stored,
      deleteItem: async (key) => {
        if (key === "access") {
          stored.items.delete(key);
        }
      },
    },
    ["access", "refresh"],
  );

  expect(result.ok ? undefined : result.error.message).toBe(
    "session tokens still stored after the delete: refresh",
  );
});

it("reports a delete that rejects", async () => {
  const keychainDelete = new Error("keychain delete");

  const result = await clearStoredTokens(
    {
      ...storage({ deletes: true }),
      deleteItem: async () => {
        throw keychainDelete;
      },
    },
    ["access", "refresh"],
  );

  expect(result.ok ? undefined : result.error).toBe(keychainDelete);
});

it("stops asking once a retry clears the tokens", async () => {
  const askToRetry = mock(async () => true);
  const clearTokens = mock(cleared);

  await retryClearTokens({
    clearTokens,
    askToRetry,
  });

  expect(askToRetry).toHaveBeenCalledTimes(1);
  expect(clearTokens).toHaveBeenCalledTimes(1);
});

it("asks again after a failed retry", async () => {
  const askToRetry = mock(async () => askToRetry.mock.calls.length < 2);

  await retryClearTokens({
    clearTokens: async () => R.failure(new Error("retried")),
    askToRetry,
  });

  expect(askToRetry).toHaveBeenCalledTimes(2);
});

it("leaves the tokens when the member declines to retry", async () => {
  const clearTokens = mock(cleared);

  await retryClearTokens({
    clearTokens,
    askToRetry: async () => false,
  });

  expect(clearTokens).not.toHaveBeenCalled();
});

it("loads the member the session belongs to", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });

  const loaded = await loadSessionUser();

  expect(loaded.ok ? loaded.value.id : undefined).toBe(1);
});

it("reports a session the server refuses", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => new Response(null, { status: 401 }),
  });

  const loaded = await loadSessionUser();

  expect(loaded.ok ? undefined : loaded.error).toBeInstanceOf(
    SessionRefusedError,
  );
});

it("tells a server it couldn't reach apart from a refusal", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => {
      throw new TypeError("fetch failed: offline");
    },
  });

  const loaded = await loadSessionUser();

  expect(loaded.ok).toBe(false);
  expect(loaded.ok ? undefined : loaded.error).not.toBeInstanceOf(
    SessionRefusedError,
  );
});

it("tells a server error apart from a refusal", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => new Response(null, { status: 503 }),
  });

  const loaded = await loadSessionUser();

  expect(loaded.ok).toBe(false);
  expect(loaded.ok ? undefined : loaded.error).not.toBeInstanceOf(
    SessionRefusedError,
  );
});

const restore = ({
  getAccessToken = async (): Promise<string | null> => "stored",
  getRefreshToken = async (): Promise<string | null> => null,
} = {}) => {
  const dropSession = mock(async () => {});
  const reportFailure = mock((_error: Error) => {});
  const consoleError = spyOn(console, "error").mockImplementation(() => {});
  return {
    dropSession,
    reportFailure,
    consoleError,
    restored: restoreSession({
      getAccessToken,
      getRefreshToken,
      dropSession,
      reportFailure,
    }),
  };
};

it("loads the member with the stored access token", async () => {
  const sent = mock();
  api.throwingOnRefusal({
    "GET /auth/me": ({ request }) => {
      sent(request.headers.get("authorization"));
      return Response.json({ user: { id: 1 } });
    },
  });

  await restore({ getAccessToken: async () => "stored" }).restored;

  expect(sent).toHaveBeenCalledWith("Bearer stored");
});

it("keeps and reports a session whose stored token it couldn't read", async () => {
  const unreadable = new Error("keychain unavailable");

  const { dropSession, reportFailure, restored } = restore({
    getAccessToken: async () => {
      throw unreadable;
    },
  });
  expect((await restored).ok).toBe(false);

  expect(dropSession).not.toHaveBeenCalled();
  expect(reportFailure).toHaveBeenCalledWith(unreadable);
});

it("loads the member with a stored access token when the refresh token can't be read", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });
  const getRefreshToken = mock(async (): Promise<string | null> => {
    throw new Error("keychain unavailable");
  });

  const { reportFailure, restored } = restore({ getRefreshToken });
  const result = await restored;

  expect(result.ok ? result.value?.id : undefined).toBe(1);
  expect(getRefreshToken).not.toHaveBeenCalled();
  expect(reportFailure).not.toHaveBeenCalled();
});

it("keeps and reports a session whose stored refresh token it couldn't read", async () => {
  const unreadable = new Error("keychain unavailable");

  const { dropSession, reportFailure, restored } = restore({
    getAccessToken: async () => null,
    getRefreshToken: async () => {
      throw unreadable;
    },
  });
  expect((await restored).ok).toBe(false);

  expect(dropSession).not.toHaveBeenCalled();
  expect(reportFailure).toHaveBeenCalledWith(unreadable);
});

it("restores the member without dropping the session", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });

  const { dropSession, reportFailure, restored } = restore();
  const result = await restored;

  expect(result.ok ? result.value?.id : undefined).toBe(1);
  expect(dropSession).not.toHaveBeenCalled();
  expect(reportFailure).not.toHaveBeenCalled();
});

it("drops a session the server refuses at launch and settles on no member", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => new Response(null, { status: 401 }),
  });

  const { dropSession, reportFailure, restored } = restore();
  const result = await restored;

  expect(result.ok && result.value).toBeUndefined();
  expect(dropSession).toHaveBeenCalled();
  expect(reportFailure).not.toHaveBeenCalled();
});

it("settles on no member without asking the server when no token is stored", async () => {
  const me = mock(() => new Response(null, { status: 503 }));
  api.throwingOnRefusal({ "GET /auth/me": me });

  const { dropSession, reportFailure, restored } = restore({
    getAccessToken: async () => null,
  });
  const result = await restored;

  expect(result.ok && result.value).toBeUndefined();
  expect(me).not.toHaveBeenCalled();
  expect(dropSession).not.toHaveBeenCalled();
  expect(reportFailure).not.toHaveBeenCalled();
});

it("keeps and reports a session the server failed to load at launch", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => new Response(null, { status: 503 }),
  });

  const { dropSession, reportFailure, restored } = restore();
  expect((await restored).ok).toBe(false);

  expect(dropSession).not.toHaveBeenCalled();
  expect(reportFailure).toHaveBeenCalled();
});

it("keeps a session it couldn't reach the server for, without reporting it", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => {
      throw FetchError.createFromError(new Error("offline"));
    },
  });

  const { dropSession, reportFailure, consoleError, restored } = restore();
  expect((await restored).ok).toBe(false);

  expect(dropSession).not.toHaveBeenCalled();
  expect(reportFailure).not.toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalled();
});

it.each([
  { outcome: "fails", launchMe: () => new Response(null, { status: 503 }) },
  {
    outcome: "is refused",
    launchMe: () => new Response(null, { status: 401 }),
  },
  { outcome: "loads", launchMe: () => Response.json({ user: { id: 1 } }) },
])(
  "leaves a login that lands while the launch load $outcome alone",
  async ({ launchMe }) => {
    const launchSent = Promise.withResolvers<void>();
    const launchAnswered = Promise.withResolvers<void>();
    let calls = 0;
    api.throwingOnRefusal({
      "GET /auth/me": async () => {
        if (++calls > 1) return Response.json({ user: { id: 2 } });
        launchSent.resolve();
        await launchAnswered.promise;
        return launchMe();
      },
    });

    const { dropSession, reportFailure, restored } = restore();
    await launchSent.promise;
    expect((await start().opened).ok).toBe(true);
    launchAnswered.resolve();
    const result = await restored;

    expect(!result.ok && result.error).toBeInstanceOf(SessionOvertakenError);
    expect(dropSession).not.toHaveBeenCalled();
    expect(reportFailure).not.toHaveBeenCalled();
  },
);

it("leaves the stored session alone when a login fails while the launch load is out", async () => {
  const launchSent = Promise.withResolvers<void>();
  const launchAnswered = Promise.withResolvers<void>();
  let calls = 0;
  api.throwingOnRefusal({
    "GET /auth/me": async () => {
      if (++calls > 1) return new Response(null, { status: 503 });
      launchSent.resolve();
      await launchAnswered.promise;
      return Response.json({ user: { id: 1 } });
    },
  });

  const { dropSession, reportFailure, restored } = restore();
  await launchSent.promise;
  expect((await start().opened).ok).toBe(false);
  launchAnswered.resolve();
  const result = await restored;

  expect(!result.ok && result.error).toBeInstanceOf(SessionOvertakenError);
  expect(dropSession).not.toHaveBeenCalled();
  expect(reportFailure).not.toHaveBeenCalled();
});

it("leaves a logout that lands while the launch load is out alone", async () => {
  const launchSent = Promise.withResolvers<void>();
  const launchAnswered = Promise.withResolvers<void>();
  api.throwingOnRefusal({
    "GET /auth/me": async () => {
      launchSent.resolve();
      await launchAnswered.promise;
      return Response.json({ user: { id: 1 } });
    },
    "POST /auth/logout": () => new Response(null, { status: 200 }),
  });

  const { dropSession, reportFailure, restored } = restore();
  await launchSent.promise;
  expect((await closeSession(cleared)).ok).toBe(true);
  launchAnswered.resolve();
  const result = await restored;

  expect(!result.ok && result.error).toBeInstanceOf(SessionOvertakenError);
  expect(dropSession).not.toHaveBeenCalled();
  expect(reportFailure).not.toHaveBeenCalled();
  expect(currentSession()).toBeUndefined();
});

it.each([
  { token: "access", outcome: "finds one", read: () => "stored" },
  { token: "access", outcome: "finds none", read: () => null },
  {
    token: "access",
    outcome: "fails",
    read: () => Promise.reject(new Error("keychain")),
  },
  { token: "refresh", outcome: "finds none", read: () => null },
  {
    token: "refresh",
    outcome: "fails",
    read: () => Promise.reject(new Error("keychain")),
  },
])(
  "leaves a login that lands while the launch's $token token read $outcome alone",
  async ({ token, read }) => {
    api.throwingOnRefusal({
      "GET /auth/me": () => Response.json({ user: { id: 2 } }),
    });
    const readStarted = Promise.withResolvers<void>();
    const loginOpened = Promise.withResolvers<void>();
    const delayedRead = async () => {
      readStarted.resolve();
      await loginOpened.promise;
      return read();
    };

    const { dropSession, reportFailure, restored } = restore(
      token === "access"
        ? { getAccessToken: delayedRead }
        : { getAccessToken: async () => null, getRefreshToken: delayedRead },
    );
    await readStarted.promise;
    expect((await start().opened).ok).toBe(true);
    loginOpened.resolve();
    const result = await restored;

    expect(!result.ok && result.error).toBeInstanceOf(SessionOvertakenError);
    expect(dropSession).not.toHaveBeenCalled();
    expect(reportFailure).not.toHaveBeenCalled();
    expect(await nextAuthorization()).toBe("Bearer access");
  },
);

const serveRefreshing = (
  table: RouteTable,
  { refreshToken = "refresh" }: { refreshToken?: string | null } = {},
) => {
  api.throwingOnRefusal(table);
  const served = client.getConfig().fetch;
  if (!served) throw new Error("serveApi set no fetch");
  const saveTokens = mock(
    async (_tokens: { access: string; refresh: string | undefined }) => {},
  );
  client.setConfig({
    fetch: refreshingFetch({
      fetch: served,
      getRefreshToken: async () => refreshToken,
      saveTokens,
    }),
  });
  return { saveTokens };
};

const expiredMe = ({ request }: { request: Request }) =>
  request.headers.get("authorization") === "Bearer refreshed"
    ? Response.json({ user: { id: 1 } })
    : new Response(null, { status: 401 });

it("retries a refused request with refreshed tokens", async () => {
  const refreshedWith = mock();
  const { saveTokens } = serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/refresh": ({ request }) => {
      refreshedWith(request.headers.get("authorization"));
      return Response.json({
        access_token: "refreshed",
        refresh_token: "next",
      });
    },
  });
  setAuthHeader("expired");

  const me = await authMe();

  expect(me.data?.user.id).toBe(1);
  expect(refreshedWith).toHaveBeenCalledWith("Bearer refresh");
  expect(saveTokens).toHaveBeenCalledWith({
    access: "refreshed",
    refresh: "next",
  });
  expect(await nextAuthorization()).toBe("Bearer refreshed");
});

it("loads the member with refreshed tokens", async () => {
  const { saveTokens } = serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/refresh": () =>
      Response.json({ access_token: "refreshed", refresh_token: "next" }),
  });

  const loaded = await loadSessionUser();

  expect(loaded.ok ? loaded.value.id : undefined).toBe(1);
  expect(saveTokens).toHaveBeenCalledWith({
    access: "refreshed",
    refresh: "next",
  });
  expect(await nextAuthorization()).toBe("Bearer refreshed");
});

it("reports a session whose refresh the server refuses", async () => {
  serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/refresh": () => new Response(null, { status: 401 }),
  });

  const loaded = await loadSessionUser();

  expect(loaded.ok ? undefined : loaded.error).toBeInstanceOf(
    SessionRefusedError,
  );
});

it("restores the member from a stored refresh token alone", async () => {
  serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/refresh": () =>
      Response.json({ access_token: "refreshed", refresh_token: "next" }),
  });

  const { dropSession, restored } = restore({
    getAccessToken: async () => null,
    getRefreshToken: async () => "refresh",
  });
  const result = await restored;

  expect(result.ok ? result.value?.id : undefined).toBe(1);
  expect(dropSession).not.toHaveBeenCalled();
});

it("drops a stored refresh token the server refuses at launch", async () => {
  serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/refresh": () => new Response(null, { status: 401 }),
  });

  const { dropSession, restored } = restore({
    getAccessToken: async () => null,
    getRefreshToken: async () => "refresh",
  });
  await restored;

  expect(dropSession).toHaveBeenCalled();
});

it("reports a session with no refresh token to try", async () => {
  serveRefreshing(
    { "GET /auth/me": () => new Response(null, { status: 401 }) },
    { refreshToken: null },
  );

  const loaded = await loadSessionUser();

  expect(loaded.ok ? undefined : loaded.error).toBeInstanceOf(
    SessionRefusedError,
  );
});

it("reports a session the server refuses after a refresh", async () => {
  serveRefreshing({
    "GET /auth/me": () => new Response(null, { status: 401 }),
    "POST /auth/refresh": () =>
      Response.json({ access_token: "refreshed", refresh_token: "next" }),
  });

  const loaded = await loadSessionUser();

  expect(loaded.ok ? undefined : loaded.error).toBeInstanceOf(
    SessionRefusedError,
  );
});

it("tells a refresh the server failed apart from a refusal", async () => {
  serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/refresh": () => new Response(null, { status: 503 }),
  });

  const loaded = await loadSessionUser();

  expect(loaded.ok).toBe(false);
  expect(loaded.ok ? undefined : loaded.error).not.toBeInstanceOf(
    SessionRefusedError,
  );
});

it("tells a refresh that never got a response apart from a refusal", async () => {
  serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/refresh": () => {
      throw new TypeError("fetch failed: offline");
    },
  });

  const loaded = await loadSessionUser();

  expect(loaded.ok).toBe(false);
  expect(loaded.ok ? undefined : loaded.error).not.toBeInstanceOf(
    SessionRefusedError,
  );
});

const openedSession = (): number => {
  const session = currentSession();
  if (session === undefined) throw new Error("no session open");
  return session;
};

const keychain = (initial?: SessionTokens) => {
  let stored = initial;
  return {
    stored: () => stored,
    saveTokens: async (tokens: SessionTokens) => {
      stored = tokens;
    },
    clearTokens: async (): Promise<Result<void, Error>> => {
      stored = undefined;
      return R.success(undefined);
    },
  };
};

const settleAfterDeadlines = async <T>(promise: Promise<T>): Promise<T> => {
  let settled = false;
  void promise.finally(() => {
    settled = true;
  });
  while (!settled) {
    jest.advanceTimersByTime(milliseconds({ seconds: 5 }));
    await new Promise((resolve) => setImmediate(resolve));
  }
  return await promise;
};

const startRefreshSave = async (saveTokens: () => Promise<void>) => {
  const started = Promise.withResolvers<void>();
  const applied = applyRefresh({
    session: openedSession(),
    accessToken: "refreshed",
    saveTokens: () => {
      started.resolve();
      return saveTokens();
    },
  });
  await started.promise;
  return { applied };
};

const serveLogout = () =>
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
  });

it("reports a refused session during an HTTP refresh", async () => {
  serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/refresh": () => new Response(null, { status: 401 }),
  });
  const refused = mock();
  subscribeToSessionRefusal(refused);
  setAuthHeader("expired");

  const me = await authMe({ throwOnError: false });

  expect(me.response.status).toBe(401);
  expect(refused).toHaveBeenCalledTimes(1);
});

it.each([
  { reason: "refused", refreshToken: "refresh" },
  { reason: "missing", refreshToken: null },
])(
  "reports a $reason session during a socket refresh",
  async ({ refreshToken }) => {
    api.throwingOnRefusal({
      "POST /auth/refresh": () => new Response(null, { status: 401 }),
    });
    const refused = mock();
    subscribeToSessionRefusal(refused);

    const refreshed = await refreshOpenSession({
      getRefreshToken: async () => refreshToken,
      saveTokens: async () => {},
    });

    expect(refreshed).toEqual(R.success(undefined));
    expect(refused).toHaveBeenCalledTimes(1);
  },
);

it("keeps a newer login when an old socket refresh is refused", async () => {
  const refreshing = Promise.withResolvers<void>();
  const answer = Promise.withResolvers<void>();
  api.throwingOnRefusal({
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
    "POST /auth/refresh": async () => {
      refreshing.resolve();
      await answer.promise;
      return new Response(null, { status: 401 });
    },
  });
  const refused = mock();
  subscribeToSessionRefusal(refused);
  const refreshingSession = refreshOpenSession({
    getRefreshToken: async () => "refresh",
    saveTokens: async () => {},
  });
  await refreshing.promise;
  expect((await start().opened).ok).toBe(true);
  const newSession = openedSession();
  answer.resolve();

  expect(await refreshingSession).toEqual(R.success(undefined));
  expect(refused).not.toHaveBeenCalled();
  expect(currentSession()).toBe(newSession);
  expect(await nextAuthorization()).toBe("Bearer access");
});

it("ignores a missing token read that returns after logout", async () => {
  serveLogout();
  const token = Promise.withResolvers<string | null>();
  const refused = mock();
  subscribeToSessionRefusal(refused);
  const refreshing = refreshOpenSession({
    getRefreshToken: () => token.promise,
    saveTokens: async () => {},
  });
  await closeSession(cleared);
  token.resolve(null);

  expect(await refreshing).toEqual(R.success(undefined));
  expect(refused).not.toHaveBeenCalled();
});

it.each([
  {
    reason: "server outage",
    respond: () => new Response(null, { status: 503 }),
  },
  {
    reason: "network failure",
    respond: () => {
      throw new Error("offline");
    },
  },
])("keeps the session after a refresh $reason", async ({ respond }) => {
  api.throwingOnRefusal({ "POST /auth/refresh": respond });
  const refused = mock();
  subscribeToSessionRefusal(refused);
  const session = openedSession();

  const refreshed = await refreshOpenSession({
    getRefreshToken: async () => "refresh",
    saveTokens: async () => {},
  });

  expect(refreshed.ok).toBe(false);
  expect(refused).not.toHaveBeenCalled();
  expect(currentSession()).toBe(session);
});

const refuseRefresh = () =>
  refreshOpenSession({
    getRefreshToken: async () => null,
    saveTokens: async () => {},
  });

it("removes the session refusal listener on cleanup", async () => {
  const refused = mock();
  const unsubscribe = subscribeToSessionRefusal(refused);
  unsubscribe();

  await refuseRefresh();

  expect(refused).not.toHaveBeenCalled();
});

it("drops a signed-in session once it is refused", async () => {
  const dropSession = mock(async () => {});
  dropSessionOnRefusal({ signedIn: true, dropSession });

  await refuseRefresh();

  expect(dropSession).toHaveBeenCalledTimes(1);
});

it("drops a session refused by several requests once", async () => {
  serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/refresh": () => new Response(null, { status: 401 }),
    "POST /auth/logout": () => new Response(null, { status: 200 }),
  });
  const dropping = Promise.withResolvers<void>();
  const dropSession = mock(async () => {
    await dropping.promise;
    await closeSession(cleared);
  });
  dropSessionOnRefusal({ signedIn: true, dropSession });
  setAuthHeader("expired");

  await Promise.all([
    authMe({ throwOnError: false }),
    authMe({ throwOnError: false }),
  ]);
  dropping.resolve();
  await dropSession.mock.results[0]?.value;

  expect(dropSession).toHaveBeenCalledTimes(1);
});

it("leaves a refusal before sign-in to the launch", async () => {
  const dropSession = mock(async () => {});
  expect(
    dropSessionOnRefusal({ signedIn: false, dropSession }),
  ).toBeUndefined();

  await refuseRefresh();

  expect(dropSession).not.toHaveBeenCalled();
});

it("stops dropping the session once signed-in cleanup runs", async () => {
  const dropSession = mock(async () => {});
  dropSessionOnRefusal({ signedIn: true, dropSession })?.();

  await refuseRefresh();

  expect(dropSession).not.toHaveBeenCalled();
});

it("sets the refreshed token while the session is open", async () => {
  const saveTokens = mock(async () => {});

  const applied = await applyRefresh({
    session: openedSession(),
    accessToken: "refreshed",
    saveTokens,
  });

  expect(applied).toBe(true);
  expect(saveTokens).toHaveBeenCalled();
  expect(await nextAuthorization()).toBe("Bearer refreshed");
});

it("drops a refresh that returns after logout", async () => {
  serveLogout();
  setAuthHeader("access");
  const session = openedSession();
  await closeSession(cleared);
  const saveTokens = mock(async () => {});

  const applied = await applyRefresh({
    session,
    accessToken: "refreshed",
    saveTokens,
  });

  expect(applied).toBe(false);
  expect(saveTokens).not.toHaveBeenCalled();
  expect(await nextAuthorization()).toBeNull();
});

it("clears the tokens after a refresh save that logout lands in", async () => {
  serveLogout();
  setAuthHeader("access");
  const saving = Promise.withResolvers<void>();
  const order: string[] = [];

  const { applied: applying } = await startRefreshSave(async () => {
    await saving.promise;
    order.push("saved");
  });
  const closing = closeSession(async () => {
    order.push("cleared");
    return R.success(undefined);
  });
  saving.resolve();

  expect(await applying).toBe(false);
  expect((await closing).ok).toBe(true);
  expect(order).toEqual(["saved", "cleared"]);
  expect(await nextAuthorization()).toBeNull();
});

it("drops a refresh save still queued when logout lands", async () => {
  serveLogout();
  const slowSave = Promise.withResolvers<void>();
  const order: string[] = [];
  const session = openedSession();

  const { applied: slow } = await startRefreshSave(async () => {
    await slowSave.promise;
    order.push("saved slow");
  });
  const fast = applyRefresh({
    session,
    accessToken: "fast",
    saveTokens: async () => {
      order.push("saved fast");
    },
  });
  const closing = closeSession(async () => {
    order.push("cleared");
    return R.success(undefined);
  });
  slowSave.resolve();

  expect(await slow).toBe(false);
  expect(await fast).toBe(false);
  expect((await closing).ok).toBe(true);
  expect(order).toEqual(["saved slow", "cleared"]);
});

it("returns the 401 when logout lands while the refresh is out", async () => {
  const refreshing = Promise.withResolvers<void>();
  const answer = Promise.withResolvers<void>();
  const { saveTokens } = serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "POST /auth/refresh": async () => {
      refreshing.resolve();
      await answer.promise;
      return Response.json({
        access_token: "refreshed",
        refresh_token: "next",
      });
    },
  });
  setAuthHeader("expired");

  const me = authMe({ throwOnError: false });
  await refreshing.promise;
  await closeSession(cleared);
  answer.resolve();

  expect((await me).response.status).toBe(401);
  expect(saveTokens).not.toHaveBeenCalled();
  expect(await nextAuthorization()).toBeNull();
});

it("skips the refresh for a request sent after logout", async () => {
  const deleting = Promise.withResolvers<void>();
  const refreshed = mock();
  const { saveTokens } = serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "POST /auth/refresh": () => {
      refreshed();
      return Response.json({
        access_token: "refreshed",
        refresh_token: "next",
      });
    },
  });
  setAuthHeader("access");
  const closing = closeSession(async () => {
    await deleting.promise;
    return R.success(undefined);
  });

  const me = await authMe({ throwOnError: false });
  deleting.resolve();
  await closing;

  expect(me.response.status).toBe(401);
  expect(refreshed).not.toHaveBeenCalled();
  expect(saveTokens).not.toHaveBeenCalled();
  expect(await nextAuthorization()).toBeNull();
});

it("skips the refresh for a request whose session a login replaced", async () => {
  const sent = Promise.withResolvers<void>();
  const answer = Promise.withResolvers<void>();
  const refreshed = mock();
  serveRefreshing({
    "GET /auth/me": async ({ request }) => {
      if (request.headers.get("authorization") === "Bearer access") {
        return Response.json({ user: { id: 1 } });
      }
      sent.resolve();
      await answer.promise;
      return new Response(null, { status: 401 });
    },
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "POST /auth/refresh": () => {
      refreshed();
      return Response.json({
        access_token: "refreshed",
        refresh_token: "next",
      });
    },
  });
  setAuthHeader("expired");

  const me = authMe({ throwOnError: false });
  await sent.promise;
  await closeSession(cleared);
  await openSession({
    tokens,
    saveTokens: async () => {},
    clearTokens: cleared,
  });
  answer.resolve();

  expect((await me).response.status).toBe(401);
  expect(refreshed).not.toHaveBeenCalled();
});

it("refreshes again once a login follows a logout", async () => {
  serveLogout();
  await closeSession(cleared);
  api.throwingOnRefusal({
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });
  await openSession({
    tokens,
    saveTokens: async () => {},
    clearTokens: cleared,
  });
  const { saveTokens } = serveRefreshing({
    "GET /auth/me": expiredMe,
    "POST /auth/refresh": () =>
      Response.json({ access_token: "refreshed", refresh_token: "next" }),
  });
  setAuthHeader("expired");

  const me = await authMe();

  expect(me.data?.user.id).toBe(1);
  expect(saveTokens).toHaveBeenCalled();
});

it("skips the refresh after a login that failed to load the profile", async () => {
  const refreshed = mock();
  const { saveTokens } = serveRefreshing({
    "GET /auth/me": () => new Response(null, { status: 401 }),
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "POST /auth/refresh": () => {
      refreshed();
      return Response.json({
        access_token: "refreshed",
        refresh_token: "next",
      });
    },
  });
  await closeSession(async () => R.failure(new Error("keychain delete")));
  const opened = await openSession({
    tokens,
    saveTokens,
    clearTokens: cleared,
  });

  const me = await authMe({ throwOnError: false });

  expect(opened.ok).toBe(false);
  expect(me.response.status).toBe(401);
  expect(refreshed).not.toHaveBeenCalled();
  expect(saveTokens).not.toHaveBeenCalled();
});

it("leaves the session closed after a login that failed to save its tokens", async () => {
  serveLogout();
  await closeSession(cleared);
  api.throwingOnRefusal({
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });

  const opened = await openSession({
    tokens,
    saveTokens: async () => {
      throw new Error("keychain");
    },
    clearTokens: cleared,
  });

  expect(opened.ok).toBe(false);
  expect(currentSession()).toBeUndefined();
});

it("deletes the tokens even when a refresh save never settles", async () => {
  jest.useFakeTimers();
  serveLogout();
  const clearTokens = mock(cleared);
  await startRefreshSave(() => new Promise<void>(() => {}));

  const closing = closeSession(clearTokens);
  jest.advanceTimersByTime(milliseconds({ seconds: 5 }));

  expect((await closing).ok).toBe(true);
  expect(clearTokens).toHaveBeenCalled();
});

it("saves a login's tokens after a refresh save from the session it replaces", async () => {
  const answeredMe = Promise.withResolvers<void>();
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "GET /auth/me": () => {
      answeredMe.resolve();
      return Response.json({ user: { id: 1 } });
    },
  });
  const storage = keychain({ access: "old", refresh: "old" });
  const saving = Promise.withResolvers<void>();
  await startRefreshSave(async () => {
    await saving.promise;
    await storage.saveTokens({ access: "refreshed", refresh: "next" });
  });

  const closing = closeSession(storage.clearTokens);
  const opening = openSession({
    tokens,
    saveTokens: storage.saveTokens,
    clearTokens: storage.clearTokens,
  });
  await answeredMe.promise;
  await new Promise((resolve) => setTimeout(resolve, 0));
  saving.resolve();

  expect((await opening).ok).toBe(true);
  expect((await closing).ok).toBe(true);
  expect(storage.stored()).toEqual({ access: "access", refresh: "refresh" });
});

it("saves a login's tokens even when a refresh save never settles", async () => {
  jest.useFakeTimers();
  api.throwingOnRefusal({
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });
  const storage = keychain();
  await startRefreshSave(() => new Promise<void>(() => {}));

  const opened = await settleAfterDeadlines(
    openSession({
      tokens,
      saveTokens: storage.saveTokens,
      clearTokens: storage.clearTokens,
    }),
  );

  expect(opened.ok).toBe(true);
  expect(storage.stored()).toEqual({ access: "access", refresh: "refresh" });
});

it("saves a login's tokens after a delete the logout already started", async () => {
  const answeredMe = Promise.withResolvers<void>();
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "GET /auth/me": () => {
      answeredMe.resolve();
      return Response.json({ user: { id: 1 } });
    },
  });
  const deleting = Promise.withResolvers<void>();
  const order: string[] = [];

  const closing = closeSession(async () => {
    await deleting.promise;
    order.push("cleared");
    return R.success(undefined);
  });
  const opening = openSession({
    tokens,
    saveTokens: async () => {
      order.push("saved");
    },
    clearTokens: cleared,
  });
  await answeredMe.promise;
  await new Promise((resolve) => setTimeout(resolve, 0));
  deleting.resolve();

  expect((await opening).ok).toBe(true);
  expect((await closing).ok).toBe(true);
  expect(order).toEqual(["cleared", "saved"]);
  expect(currentSession()).toBeDefined();
});

it("saves a login's tokens even when a logout's delete never settles", async () => {
  jest.useFakeTimers();
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });
  const storage = keychain();
  void closeSession(() => new Promise(() => {}));

  const opened = await settleAfterDeadlines(
    openSession({
      tokens,
      saveTokens: storage.saveTokens,
      clearTokens: storage.clearTokens,
    }),
  );

  expect(opened.ok).toBe(true);
  expect(storage.stored()).toEqual({ access: "access", refresh: "refresh" });
});

it("writes the login's tokens again when a delete lands after the deadline", async () => {
  jest.useFakeTimers();
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });
  const storage = keychain({ access: "old", refresh: "old" });
  const deleting = Promise.withResolvers<void>();
  void closeSession(async () => {
    await deleting.promise;
    return await storage.clearTokens();
  });

  const opened = await settleAfterDeadlines(
    openSession({
      tokens,
      saveTokens: storage.saveTokens,
      clearTokens: storage.clearTokens,
    }),
  );
  jest.useRealTimers();
  deleting.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(opened.ok).toBe(true);
  expect(storage.stored()).toEqual({ access: "access", refresh: "refresh" });
});

it("keeps a later login's tokens when an earlier login fails to save", async () => {
  const answeredBoth = Promise.withResolvers<void>();
  let answered = 0;
  api.throwingOnRefusal({
    "GET /auth/me": () => {
      if (++answered === 2) answeredBoth.resolve();
      return Response.json({ user: { id: 1 } });
    },
  });
  const storage = keychain();
  const failing = Promise.withResolvers<void>();

  const first = openSession({
    tokens: { access_token: "first", refresh_token: "first" },
    saveTokens: () => failing.promise,
    clearTokens: storage.clearTokens,
  });
  const second = openSession({
    tokens,
    saveTokens: storage.saveTokens,
    clearTokens: storage.clearTokens,
  });
  await answeredBoth.promise;
  await new Promise((resolve) => setTimeout(resolve, 0));
  failing.reject(new Error("keychain"));

  expect((await first).ok).toBe(false);
  expect((await second).ok).toBe(true);
  expect(storage.stored()).toEqual({ access: "access", refresh: "refresh" });
  expect(currentSession()).toBeDefined();
});

it("deletes the tokens again when a save lands after the deadline", async () => {
  jest.useFakeTimers();
  serveLogout();
  const saving = Promise.withResolvers<void>();
  const clearTokens = mock(cleared);
  await startRefreshSave(() => saving.promise);

  const closing = closeSession(clearTokens);
  jest.advanceTimersByTime(milliseconds({ seconds: 5 }));
  expect((await closing).ok).toBe(true);
  expect(clearTokens).toHaveBeenCalledTimes(1);

  jest.useRealTimers();
  saving.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(clearTokens).toHaveBeenCalledTimes(2);
});

it("writes the login's tokens again when a save lands after the deadline", async () => {
  jest.useFakeTimers();
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });
  const storage = keychain({ access: "old", refresh: "old" });
  const saving = Promise.withResolvers<void>();
  await startRefreshSave(async () => {
    await saving.promise;
    await storage.saveTokens({ access: "refreshed", refresh: "next" });
  });

  const closing = closeSession(storage.clearTokens);
  jest.advanceTimersByTime(milliseconds({ seconds: 5 }));
  await closing;
  jest.useRealTimers();
  const opened = await openSession({
    tokens,
    saveTokens: storage.saveTokens,
    clearTokens: storage.clearTokens,
  });
  saving.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(opened.ok).toBe(true);
  expect(storage.stored()).toEqual({ access: "access", refresh: "refresh" });
});

it("writes the open session's refreshed tokens again when a save lands after the deadline", async () => {
  jest.useFakeTimers();
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });
  const storage = keychain({ access: "old", refresh: "old" });
  const saving = Promise.withResolvers<void>();
  await startRefreshSave(async () => {
    await saving.promise;
    await storage.saveTokens({ access: "refreshed", refresh: "next" });
  });

  const closing = closeSession(storage.clearTokens);
  jest.advanceTimersByTime(milliseconds({ seconds: 5 }));
  await closing;
  jest.useRealTimers();
  await openSession({
    tokens,
    saveTokens: storage.saveTokens,
    clearTokens: storage.clearTokens,
  });
  await applyRefresh({
    session: openedSession(),
    accessToken: "newer",
    saveTokens: () => storage.saveTokens({ access: "newer", refresh: "newer" }),
  });
  saving.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(storage.stored()).toEqual({ access: "newer", refresh: "newer" });
});

it("deletes the tokens again when a save lands after a login that failed to save", async () => {
  jest.useFakeTimers();
  api.throwingOnRefusal({
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });
  const storage = keychain({ access: "old", refresh: "old" });
  const saving = Promise.withResolvers<void>();
  await startRefreshSave(async () => {
    await saving.promise;
    await storage.saveTokens({ access: "refreshed", refresh: "next" });
  });

  const opened = await settleAfterDeadlines(
    openSession({
      tokens,
      saveTokens: async () => {
        throw new Error("keychain");
      },
      clearTokens: storage.clearTokens,
    }),
  );
  jest.useRealTimers();
  saving.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(opened.ok).toBe(false);
  expect(storage.stored()).toBeUndefined();
});

it("stops waiting on a refresh save the deadline gave up on", async () => {
  jest.useFakeTimers();
  serveLogout();
  await startRefreshSave(() => new Promise<void>(() => {}));
  const first = closeSession(mock(cleared));
  jest.advanceTimersByTime(milliseconds({ seconds: 5 }));
  await first;
  jest.useRealTimers();
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });
  await openSession({
    tokens,
    saveTokens: async () => {},
    clearTokens: cleared,
  });

  let settled = false;
  const second = closeSession(mock(cleared)).then((closed) => {
    settled = true;
    return closed;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(settled).toBe(true);
  expect((await second).ok).toBe(true);
});

it("retries the delete while no session is open", async () => {
  serveLogout();
  await closeSession(async () => R.failure(new Error("keychain delete")));
  const clearTokens = mock(cleared);

  expect((await clearClosedSessionTokens(clearTokens)).ok).toBe(true);
  expect(clearTokens).toHaveBeenCalled();
});

it("skips a retried delete once a login has opened a session", async () => {
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "GET /auth/me": () => Response.json({ user: { id: 1 } }),
  });
  await closeSession(async () => R.failure(new Error("keychain delete")));
  await openSession({
    tokens,
    saveTokens: async () => {},
    clearTokens: cleared,
  });
  const clearTokens = mock(cleared);

  expect((await clearClosedSessionTokens(clearTokens)).ok).toBe(true);
  expect(clearTokens).not.toHaveBeenCalled();
});

it("skips the refresh for the profile call of a login that follows a launch", async () => {
  const refreshed = mock();
  const { saveTokens } = serveRefreshing({
    "GET /auth/me": () => new Response(null, { status: 401 }),
    "POST /auth/refresh": () => {
      refreshed();
      return Response.json({
        access_token: "refreshed",
        refresh_token: "next",
      });
    },
  });

  const opened = await openSession({
    tokens,
    saveTokens,
    clearTokens: cleared,
  });

  expect(opened.ok).toBe(false);
  expect(refreshed).not.toHaveBeenCalled();
  expect(saveTokens).not.toHaveBeenCalled();
});

const refreshing = (saveTokens = mock(async (_tokens: SessionTokens) => {})) =>
  refreshSession({
    session: openedSession(),
    getRefreshToken: async () => "refresh",
    saveTokens,
  });

it("saves both refreshed tokens and resolves to the access token", async () => {
  api.throwingOnRefusal({
    "POST /auth/refresh": () =>
      Response.json({ access_token: "refreshed", refresh_token: "next" }),
  });
  const saveTokens = mock(async (_tokens: SessionTokens) => {});

  expect(R.unwrap(await refreshing(saveTokens))).toBe("refreshed");
  expect(saveTokens).toHaveBeenCalledWith({
    access: "refreshed",
    refresh: "next",
  });
});

it("resolves to no token when the server refuses the refresh", async () => {
  api.throwingOnRefusal({
    "POST /auth/refresh": () => new Response(null, { status: 401 }),
  });

  expect(R.unwrap(await refreshing())).toBeUndefined();
});

it("fails a refresh the server answered without a refresh token", async () => {
  api.throwingOnRefusal({
    "POST /auth/refresh": () => Response.json({ access_token: "refreshed" }),
  });
  const saveTokens = mock(async (_tokens: SessionTokens) => {});

  expect(await refreshing(saveTokens)).toMatchObject({
    ok: false,
    error: { message: "token refresh answered 200 without both tokens" },
  });
  expect(saveTokens).not.toHaveBeenCalled();
});

it("fails a refresh the server couldn't answer", async () => {
  api.throwingOnRefusal({
    "POST /auth/refresh": () => new Response(null, { status: 503 }),
  });
  const saveTokens = mock(async (_tokens: SessionTokens) => {});

  expect(await refreshing(saveTokens)).toMatchObject({
    ok: false,
    error: { message: "token refresh failed: 503" },
  });
  expect(saveTokens).not.toHaveBeenCalled();
});

it("fails a refresh whose stored token it couldn't read", async () => {
  const saveTokens = mock(async (_tokens: SessionTokens) => {});

  const refreshed = await refreshSession({
    session: openedSession(),
    getRefreshToken: async () => {
      throw new Error("the keychain is locked");
    },
    saveTokens,
  });

  expect(refreshed).toMatchObject({ ok: false });
  expect(saveTokens).not.toHaveBeenCalled();
});

it("resolves to no token when logout lands while the refresh is out", async () => {
  const answer = Promise.withResolvers<void>();
  api.throwingOnRefusal({
    "POST /auth/logout": () => new Response(null, { status: 200 }),
    "POST /auth/refresh": async () => {
      await answer.promise;
      return Response.json({
        access_token: "refreshed",
        refresh_token: "next",
      });
    },
  });
  const saveTokens = mock(async (_tokens: SessionTokens) => {});

  const refreshed = refreshing(saveTokens);
  await closeSession(cleared);
  answer.resolve();

  expect(R.unwrap(await refreshed)).toBeUndefined();
  expect(saveTokens).not.toHaveBeenCalled();
});

it("refreshes whatever session is open", async () => {
  api.throwingOnRefusal({
    "POST /auth/refresh": () =>
      Response.json({ access_token: "refreshed", refresh_token: "next" }),
  });
  const saveTokens = mock(async (_tokens: SessionTokens) => {});

  const refreshed = await refreshOpenSession({
    getRefreshToken: async () => "refresh",
    saveTokens,
  });

  expect(R.unwrap(refreshed)).toBe("refreshed");
  expect(saveTokens).toHaveBeenCalledWith({
    access: "refreshed",
    refresh: "next",
  });
});

it("never asks the server for a refresh while no session is open", async () => {
  serveLogout();
  await closeSession(cleared);
  const getRefreshToken = mock(async (): Promise<string | null> => "refresh");
  const saveTokens = mock(async (_tokens: SessionTokens) => {});

  const refreshed = await refreshOpenSession({ getRefreshToken, saveTokens });

  expect(R.unwrap(refreshed)).toBeUndefined();
  expect(getRefreshToken).not.toHaveBeenCalled();
  expect(saveTokens).not.toHaveBeenCalled();
});

const credentials = { email: "member@example.com", password: "hunter2" };

it("returns the tokens the server issues for the credentials", async () => {
  api.throwingOnRefusal({
    "POST /auth/login": () => Response.json({ isAdmin: false, ...tokens }),
  });

  const result = await requestTokens(credentials);

  expect(result.ok && result.value).toEqual(tokens);
});

it.each([400, 401])(
  "reports refused credentials when the server answers %i",
  async (status) => {
    api.throwingOnRefusal({
      "POST /auth/login": () =>
        Response.json({ message: "Unauthorized" }, { status }),
    });

    const result = await requestTokens(credentials);

    expect(result.ok ? undefined : result.error).toBeInstanceOf(
      CredentialsRefusedError,
    );
  },
);

it("reports a server failure apart from refused credentials", async () => {
  api.throwingOnRefusal({
    "POST /auth/login": () => new Response(null, { status: 500 }),
  });

  const result = await requestTokens(credentials);

  expect(result.ok).toBe(false);
  expect(result.ok ? undefined : result.error).not.toBeInstanceOf(
    CredentialsRefusedError,
  );
});

it("reports a request that never gets a response", async () => {
  const unreachable = new Error("fetch failed");
  api.throwingOnRefusal({
    "POST /auth/login": () => {
      throw unreachable;
    },
  });

  const result = await requestTokens(credentials);

  expect(result.ok ? undefined : result.error).toBe(unreachable);
});

it("tells the member their password was refused without reporting it", () => {
  expect(passwordLoginFailure(new CredentialsRefusedError())).toEqual({
    message: "Invalid email or password",
    report: false,
  });
});

it.each([
  ["the login request", FetchError.createFromError(new Error("offline"))],
  [
    "the profile load",
    new Error("Failed to fetch user profile", {
      cause: FetchError.createFromError(new Error("offline")),
    }),
  ],
])(
  "asks the member to check their connection when %s gets no response",
  (_request, error) => {
    expect(passwordLoginFailure(error)).toEqual({
      message: NETWORK_FAILURE_MESSAGE,
      report: false,
    });
  },
);

it("reports any other password login failure", () => {
  expect(passwordLoginFailure(new Error("Login failed")).report).toBe(true);
});
