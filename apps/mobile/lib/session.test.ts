import { authMe } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { afterEach, expect, it, mock } from "bun:test";
import { closeSession, openSession, setAuthHeader } from "./session";

const api = serveApi(routes({}));

afterEach(() => setAuthHeader(undefined));

const tokens = { access_token: "access", refresh_token: "refresh" };

const start = ({
  saveTokens = mock(async (_access: string, _refresh: string) => {}),
  clearTokens = mock(async () => {}),
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
  expect(saveTokens).toHaveBeenCalledWith("access", "refresh");
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
    clearTokens: mock(async () => {
      throw keychainDelete;
    }),
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
  const clearTokens = mock(async () => {});

  closeSession(clearTokens);

  expect(await logout.promise).toBe("Bearer access");
  expect(clearTokens).toHaveBeenCalled();
  expect(await nextAuthorization()).toBeNull();
});
