import { R, type Result } from "@alliance/common/result";
import { authMe } from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";
import {
  routes,
  type RouteTable,
  serveApi,
} from "@alliance/shared/lib/testing/serveApi";
import { afterEach, expect, it, mock, spyOn } from "bun:test";
import { FetchError } from "expo/src/winter/fetch/FetchErrors";
import type { SessionTokens } from "./SecureStorage";
import {
  clearStoredTokens,
  closeSession,
  loadSessionUser,
  openSession,
  refreshingFetch,
  refreshSession,
  restoreSession,
  retryClearTokens,
  SessionRefusedError,
  setAuthHeader,
} from "./session";

const api = serveApi(routes({}));

afterEach(() => {
  setAuthHeader(undefined);
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

it("drops a session the server refuses at launch", async () => {
  api.throwingOnRefusal({
    "GET /auth/me": () => new Response(null, { status: 401 }),
  });

  const { dropSession, reportFailure, restored } = restore();
  await restored;

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

const refreshing = (saveTokens = mock(async (_tokens: SessionTokens) => {})) =>
  refreshSession({ getRefreshToken: async () => "refresh", saveTokens });

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
    getRefreshToken: async () => {
      throw new Error("the keychain is locked");
    },
    saveTokens,
  });

  expect(refreshed).toMatchObject({ ok: false });
  expect(saveTokens).not.toHaveBeenCalled();
});
