import { R, type Result } from "@alliance/common/result";
import { authMe } from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";
import {
  routes,
  type RouteTable,
  serveApi,
} from "@alliance/shared/lib/testing/serveApi";
import { afterEach, expect, it, mock } from "bun:test";
import {
  clearStoredTokens,
  closeSession,
  openSession,
  refreshingFetch,
  retryClearTokens,
  type SessionTokens,
  setAuthHeader,
} from "./session";

const api = serveApi(routes({}));

afterEach(() => setAuthHeader(undefined));

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
