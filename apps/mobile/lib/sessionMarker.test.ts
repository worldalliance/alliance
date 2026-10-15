import { R } from "@alliance/common/result";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { afterEach, expect, it, mock, spyOn } from "bun:test";
import { SecureStorageKey } from "./secureStorageKey";
import {
  __resetSessionForTests,
  closeSession,
  SessionOvertakenError,
} from "./session";
import {
  clearMarkedSession,
  openMarkedSession,
  restoreMarkedSession,
  saveMarkedSession,
} from "./sessionMarker";

const fakeStorage = (
  params: { failing?: SecureStorageKey; keptOnDelete?: SecureStorageKey } = {},
) => {
  const stored = new Map<SecureStorageKey, string>();
  const writes: string[] = [];
  return {
    stored,
    writes,
    storage: {
      getItem: async (key: SecureStorageKey) => stored.get(key) ?? null,
      setItem: async (key: SecureStorageKey, value: string) => {
        if (key === params.failing) throw new Error("keychain write failed");
        writes.push(`set ${key}`);
        stored.set(key, value);
      },
      deleteItem: async (key: SecureStorageKey) => {
        if (key === params.failing) throw new Error("keychain delete failed");
        writes.push(`delete ${key}`);
        if (key !== params.keptOnDelete) stored.delete(key);
      },
    },
  };
};

serveApi(routes({ "POST /auth/logout": () => new Response(null) }));

afterEach(() => __resetSessionForTests());

const tokens = { access: "access", refresh: "refresh" };

it("clears the earlier session's tokens and stores the marker before a review session's", async () => {
  const { storage, writes } = fakeStorage();

  await saveMarkedSession(storage, { tokens, review: true });

  expect(writes).toEqual([
    `delete ${SecureStorageKey.ACCESS_TOKEN}`,
    `delete ${SecureStorageKey.REFRESH_TOKEN}`,
    `set ${SecureStorageKey.REVIEW_SESSION}`,
    `set ${SecureStorageKey.ACCESS_TOKEN}`,
    `set ${SecureStorageKey.REFRESH_TOKEN}`,
  ]);
});

it("drops a previous review marker before storing an ordinary session's tokens", async () => {
  const { storage, stored, writes } = fakeStorage();
  stored.set(SecureStorageKey.REVIEW_SESSION, "true");

  await saveMarkedSession(storage, { tokens, review: false });

  expect(writes).toEqual([
    `delete ${SecureStorageKey.REVIEW_SESSION}`,
    `set ${SecureStorageKey.ACCESS_TOKEN}`,
    `set ${SecureStorageKey.REFRESH_TOKEN}`,
  ]);
  expect(stored.has(SecureStorageKey.REVIEW_SESSION)).toBe(false);
});

it("refuses to store an ordinary session's tokens beside a marker the keychain kept", async () => {
  const { storage, stored } = fakeStorage({
    keptOnDelete: SecureStorageKey.REVIEW_SESSION,
  });
  stored.set(SecureStorageKey.REVIEW_SESSION, "true");

  await expect(
    saveMarkedSession(storage, { tokens, review: false }),
  ).rejects.toThrow();
  expect(stored.has(SecureStorageKey.ACCESS_TOKEN)).toBe(false);
});

it("stores an ordinary session over a token the keychain won't delete", async () => {
  const { storage, stored } = fakeStorage({
    keptOnDelete: SecureStorageKey.ACCESS_TOKEN,
  });
  stored.set(SecureStorageKey.ACCESS_TOKEN, "earlier");

  await saveMarkedSession(storage, { tokens, review: false });

  expect(stored.get(SecureStorageKey.ACCESS_TOKEN)).toBe(tokens.access);
});

it("refuses to mark a session while the keychain keeps an earlier one's token", async () => {
  const { storage, stored } = fakeStorage({
    keptOnDelete: SecureStorageKey.REFRESH_TOKEN,
  });
  stored.set(SecureStorageKey.REFRESH_TOKEN, "production");

  await expect(
    saveMarkedSession(storage, { tokens, review: true }),
  ).rejects.toThrow();
  expect(stored.has(SecureStorageKey.REVIEW_SESSION)).toBe(false);
});

it("keeps the marker while a review token is still stored", async () => {
  const { storage, stored } = fakeStorage({
    failing: SecureStorageKey.REFRESH_TOKEN,
  });
  stored.set(SecureStorageKey.REVIEW_SESSION, "true");
  stored.set(SecureStorageKey.REFRESH_TOKEN, "refresh");

  const cleared = await clearMarkedSession(storage);

  expect(cleared.ok).toBe(false);
  expect(stored.get(SecureStorageKey.REVIEW_SESSION)).toBe("true");
});

it("clears the marker once the tokens are gone", async () => {
  const { storage, stored } = fakeStorage();
  stored.set(SecureStorageKey.REVIEW_SESSION, "true");
  stored.set(SecureStorageKey.ACCESS_TOKEN, "access");

  expect(await clearMarkedSession(storage)).toEqual(R.success(undefined));
  expect(stored.size).toBe(0);
});

it("ends a logout once the tokens are gone, though the keychain keeps the marker", async () => {
  const { storage, stored } = fakeStorage({
    keptOnDelete: SecureStorageKey.REVIEW_SESSION,
  });
  stored.set(SecureStorageKey.REVIEW_SESSION, "true");
  stored.set(SecureStorageKey.ACCESS_TOKEN, "access");
  const logged = spyOn(console, "error").mockImplementation(() => {});

  expect(await clearMarkedSession(storage)).toEqual(R.success(undefined));
  expect(logged).toHaveBeenCalledTimes(1);
  logged.mockRestore();
});

const restoreWith = async (params: {
  marked: boolean;
  restored: string | undefined;
}) => {
  const { stored } = fakeStorage();
  if (params.marked) stored.set(SecureStorageKey.REVIEW_SESSION, "true");
  const routes: boolean[] = [];
  let routedAtRead: boolean | undefined;
  const result = await restoreMarkedSession({
    storage: { getItem: async (key) => stored.get(key) ?? null },
    setReviewSession: (review) => routes.push(review),
    restore: async () => {
      routedAtRead = routes.at(-1);
      return R.success(params.restored);
    },
    reportFailure: () => {},
  });
  return { result, routes, routedAtRead };
};

it("routes to staging before a review session's tokens are read", async () => {
  const { result, routes, routedAtRead } = await restoreWith({
    marked: true,
    restored: "reviewer",
  });

  expect(result).toEqual(R.success("reviewer"));
  expect(routedAtRead).toBe(true);
  expect(routes).toEqual([true]);
});

it("routes back to the binary's deployment when no session restores", async () => {
  const { routes } = await restoreWith({ marked: true, restored: undefined });

  expect(routes).toEqual([true, false]);
});

it("restores an unmarked session against the binary's deployment", async () => {
  const { routedAtRead } = await restoreWith({
    marked: false,
    restored: "member",
  });

  expect(routedAtRead).toBe(false);
});

it("leaves the session unavailable when the marker can't be read", async () => {
  const keychain = new Error("keychain read failed");
  const setReviewSession = mock();
  const restore = mock();
  const reportFailure = mock();

  const restored = await restoreMarkedSession({
    storage: { getItem: () => Promise.reject(keychain) },
    setReviewSession,
    restore,
    reportFailure,
  });

  expect(restored).toEqual(R.failure(keychain));
  expect(reportFailure).toHaveBeenCalledWith(keychain);
  expect(setReviewSession).not.toHaveBeenCalled();
  expect(restore).not.toHaveBeenCalled();
});

it("leaves routing to a logout that overtakes the marker read", async () => {
  const setReviewSession = mock();
  const restore = mock();

  const restored = await restoreMarkedSession({
    storage: {
      getItem: async () => {
        await closeSession({
          clearTokens: async () => R.success(undefined),
          leaveDeployment: () => {},
        });
        return "true";
      },
    },
    setReviewSession,
    restore,
    reportFailure: () => {},
  });

  expect(restored.ok ? undefined : restored.error).toBeInstanceOf(
    SessionOvertakenError,
  );
  expect(setReviewSession).not.toHaveBeenCalled();
  expect(restore).not.toHaveBeenCalled();
});

const openWith = async (params: { review: boolean; opens: boolean }) => {
  const { storage, stored } = fakeStorage();
  const routes: boolean[] = [];
  let routedAtOpen: boolean | undefined;
  const result = await openMarkedSession({
    storage,
    review: params.review,
    setReviewSession: (review) => routes.push(review),
    open: async (saveTokens) => {
      routedAtOpen = routes.at(-1);
      if (!params.opens) {
        return R.failure(new Error("profile load failed"));
      }
      await saveTokens(tokens);
      return R.success("reviewer");
    },
  });
  return { result, routes, routedAtOpen, stored };
};

it.each([true, false])(
  "stores whether a new session is a review one beside its tokens (review: %p)",
  async (review) => {
    const { stored } = await openWith({ review, opens: true });

    expect(stored.get(SecureStorageKey.ACCESS_TOKEN)).toBe(tokens.access);
    expect(stored.has(SecureStorageKey.REVIEW_SESSION)).toBe(review);
  },
);

it("routes to staging before a review session's profile loads", async () => {
  const { result, routes, routedAtOpen } = await openWith({
    review: true,
    opens: true,
  });

  expect(result).toEqual(R.success("reviewer"));
  expect(routedAtOpen).toBe(true);
  expect(routes).toEqual([true]);
});

it("routes back to the binary's deployment when a session fails to open", async () => {
  const { result, routes } = await openWith({ review: true, opens: false });

  expect(result.ok).toBe(false);
  expect(routes).toEqual([true, false]);
});
