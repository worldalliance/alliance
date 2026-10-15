import { client } from "@alliance/shared/client/client.gen";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { afterAll, afterEach, beforeAll, expect, it, mock } from "bun:test";
import { getBinaryApiUrl, setReviewSession } from "./config";
import { registerDevice, unregisterDevice } from "./registeredDevice";
import { STAGING } from "./releaseTarget";
import { ReviewSecureStorage, SecureStorage } from "./SecureStorage";
import { SecureStorageKey } from "./secureStorageKey";
import { currentSession, setAuthHeader } from "./session";

const api = serveApi(routes({}));
const originalBaseUrl = client.getConfig().baseUrl;
const originalPort = process.env.EXPO_PUBLIC_ALLIANCE_API_PORT;

beforeAll(() => {
  process.env.EXPO_PUBLIC_ALLIANCE_API_PORT = "4005";
});

afterEach(async () => {
  setReviewSession(false);
  client.setConfig({ baseUrl: originalBaseUrl });
  setAuthHeader(undefined);
  for (const storage of [SecureStorage, ReviewSecureStorage]) {
    for (const key of Object.values(SecureStorageKey)) {
      await storage.deleteItem(key);
    }
  }
});

afterAll(() => {
  process.env.EXPO_PUBLIC_ALLIANCE_API_PORT = originalPort;
});

const recordUnlinks = (pathname: string) => {
  const sent = mock();
  api.throwingOnRefusal({
    [`POST ${pathname}/user/unregisterDevice`]: async ({ request }) => {
      sent({
        origin: new URL(request.url).origin,
        authorization: request.headers.get("Authorization"),
        body: await request.json(),
      });
      return new Response(null, { status: 201 });
    },
  });
  return sent;
};

it("unlinks a review session's device on staging, without its token", async () => {
  await ReviewSecureStorage.setItem(
    SecureStorageKey.DEVICE_ID,
    "review-device",
  );
  await ReviewSecureStorage.setItem(SecureStorageKey.REGISTERED_TOKEN, "token");
  await SecureStorage.setItem(SecureStorageKey.DEVICE_ID, "binary-device");
  setReviewSession(true);
  setAuthHeader("staging-access");
  const sent = recordUnlinks(new URL(STAGING.apiUrl).pathname);

  await unregisterDevice();

  expect(sent).toHaveBeenCalledTimes(1);
  expect(sent).toHaveBeenCalledWith({
    origin: new URL(STAGING.apiUrl).origin,
    authorization: null,
    body: { deviceId: "review-device", expoPushToken: "token" },
  });
  expect(await SecureStorage.getItem(SecureStorageKey.DEVICE_ID)).toBe(
    "binary-device",
  );
});

it("unlinks an ordinary session's device on the binary's deployment, without its token", async () => {
  await SecureStorage.setItem(SecureStorageKey.DEVICE_ID, "binary-device");
  await SecureStorage.setItem(SecureStorageKey.REGISTERED_TOKEN, "token");
  await ReviewSecureStorage.setItem(
    SecureStorageKey.DEVICE_ID,
    "review-device",
  );
  setAuthHeader("production-access");
  const sent = recordUnlinks("");

  await unregisterDevice();

  expect(sent).toHaveBeenCalledTimes(1);
  expect(sent).toHaveBeenCalledWith({
    origin: new URL(getBinaryApiUrl()).origin,
    authorization: null,
    body: { deviceId: "binary-device", expoPushToken: "token" },
  });
  expect(await ReviewSecureStorage.getItem(SecureStorageKey.DEVICE_ID)).toBe(
    "review-device",
  );
});

it("registers a review session's device on staging, with its token", async () => {
  setReviewSession(true);
  setAuthHeader("staging-access");
  const sent = mock();
  api.throwingOnRefusal({
    [`POST ${new URL(STAGING.apiUrl).pathname}/user/registerDevice`]: async ({
      request,
    }) => {
      sent({
        origin: new URL(request.url).origin,
        authorization: request.headers.get("Authorization"),
      });
      return Response.json({ id: "review-device" });
    },
  });

  await registerDevice({
    params: { deviceType: "phone", expoPushToken: "token" },
    session: currentSession(),
  });

  expect(sent).toHaveBeenCalledWith({
    origin: new URL(STAGING.apiUrl).origin,
    authorization: "Bearer staging-access",
  });
  expect(await ReviewSecureStorage.getItem(SecureStorageKey.DEVICE_ID)).toBe(
    "review-device",
  );
  expect(await SecureStorage.getItem(SecureStorageKey.DEVICE_ID)).toBeNull();
});
