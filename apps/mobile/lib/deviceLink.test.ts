import {
  __resetAnalyticsForTests,
  registerAnalytics,
} from "@alliance/shared/lib/analytics";
import { afterEach, expect, it, mock } from "bun:test";
import { createDeviceLink, sessionDeviceLinks } from "./deviceLink";
import { SecureStorageKey } from "./secureStorageKey";

const setUp = ({ requestDeadlineMs = 1000, failWrites = false } = {}) => {
  const stored = new Map<SecureStorageKey, string>();
  let releaseRegister: (deviceId: string) => void = () => {};
  const registered = new Promise<string>(
    (resolve) => (releaseRegister = resolve),
  );
  const register = mock((_body: object) => registered);
  const unregister = mock(async (_body: object) => {});
  const getItem = mock(
    async (key: SecureStorageKey) => stored.get(key) ?? null,
  );
  let session: number | undefined = 1;
  const link = createDeviceLink({
    storage: {
      getItem,
      setItem: async (key, value) => {
        if (failWrites) throw new Error("keychain write failed");
        stored.set(key, value);
      },
      deleteItem: async (key) => void stored.delete(key),
    },
    register,
    unregister,
    currentSession: () => session,
    requestDeadlineMs,
  });
  return {
    signOut: () => (session = undefined),
    signIn: (next: number) => (session = next),
    stored,
    getItem,
    register,
    unregister,
    link,
    releaseRegister: (deviceId: string) => releaseRegister(deviceId),
  };
};

afterEach(() => __resetAnalyticsForTests());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const device = {
  params: { deviceType: "phone", expoPushToken: "token-a" },
  session: 1,
};

it("unlinks the row a registration in flight at logout goes on to link", async () => {
  const { link, unregister, releaseRegister } = setUp();
  const registered = link.registerDevice(device);
  const unlinked = link.unregisterDevice();

  await tick();
  expect(unregister).not.toHaveBeenCalled();
  releaseRegister("device-1");
  await Promise.all([registered, unlinked]);

  expect(unregister).toHaveBeenCalledWith({
    deviceId: "device-1",
    expoPushToken: "token-a",
  });
});

it("registers only after an earlier unlink has settled", async () => {
  const { link, stored, register, unregister, releaseRegister } = setUp();
  stored.set(SecureStorageKey.DEVICE_ID, "device-1");
  stored.set(SecureStorageKey.REGISTERED_TOKEN, "token-a");
  let releaseUnregister = () => {};
  unregister.mockImplementationOnce(
    () => new Promise<void>((resolve) => (releaseUnregister = resolve)),
  );

  const unlinked = link.unregisterDevice();
  const registered = link.registerDevice({
    params: { ...device.params, expoPushToken: "token-b" },
    session: 1,
  });
  await tick();
  expect(unregister).toHaveBeenCalledTimes(1);
  expect(register).not.toHaveBeenCalled();

  releaseUnregister();
  await unlinked;
  releaseRegister("device-2");
  await registered;

  expect(register).toHaveBeenCalledTimes(1);
  expect(stored.get(SecureStorageKey.DEVICE_ID)).toBe("device-2");
  expect(stored.get(SecureStorageKey.REGISTERED_TOKEN)).toBe("token-b");
  expect(stored.get(SecureStorageKey.UNLINK_PENDING)).toBeUndefined();
});

it("retries a failed unlink until the server confirms it", async () => {
  const { link, stored, unregister } = setUp();
  stored.set(SecureStorageKey.DEVICE_ID, "device-1");
  stored.set(SecureStorageKey.REGISTERED_TOKEN, "token-a");
  unregister.mockImplementationOnce(() => Promise.reject(new Error("offline")));

  await link.unregisterDevice();
  expect(stored.get(SecureStorageKey.UNLINK_PENDING)).toBe("true");

  await link.retryPending();
  expect(unregister).toHaveBeenCalledTimes(2);
  expect(stored.get(SecureStorageKey.UNLINK_PENDING)).toBeUndefined();

  await link.retryPending();
  expect(unregister).toHaveBeenCalledTimes(2);
});

it("drops a pending unlink once a new sign-in registers the device", async () => {
  const { link, stored, unregister, releaseRegister } = setUp();
  stored.set(SecureStorageKey.UNLINK_PENDING, "true");

  const registered = link.registerDevice(device);
  releaseRegister("device-1");
  await registered;
  await link.retryPending();

  expect(unregister).not.toHaveBeenCalled();
});

it("keeps linking after a pending-unlink check fails to read storage", async () => {
  const { link, stored, getItem, unregister } = setUp();
  stored.set(SecureStorageKey.DEVICE_ID, "device-1");
  stored.set(SecureStorageKey.REGISTERED_TOKEN, "token-a");
  getItem.mockImplementationOnce(() =>
    Promise.reject(new Error("keychain locked")),
  );

  await link.retryPending();
  await link.unregisterDevice();

  expect(unregister).toHaveBeenCalledWith({
    deviceId: "device-1",
    expoPushToken: "token-a",
  });
});

it("re-registers a failed sign-in before retrying an earlier unlink", async () => {
  const { link, stored, register, unregister, releaseRegister } = setUp();
  stored.set(SecureStorageKey.DEVICE_ID, "device-1");
  stored.set(SecureStorageKey.REGISTERED_TOKEN, "token-a");
  unregister.mockImplementationOnce(() => Promise.reject(new Error("offline")));
  register.mockImplementationOnce(() => Promise.reject(new Error("offline")));

  await link.unregisterDevice();
  await link.registerDevice(device);
  releaseRegister("device-1");
  await link.retryPending();

  expect(unregister).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledTimes(2);
  expect(stored.get(SecureStorageKey.UNLINK_PENDING)).toBeUndefined();

  await link.retryPending();
  expect(unregister).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledTimes(2);
});

it("drops a failed registration once the user signs out", async () => {
  const { link, register } = setUp();
  register.mockImplementationOnce(() => Promise.reject(new Error("offline")));

  await link.registerDevice(device);
  await link.unregisterDevice();
  await link.retryPending();

  expect(register).toHaveBeenCalledTimes(1);
});

it("drops a registration whose session closed before it ran", async () => {
  const { link, register, signOut } = setUp();

  signOut();
  await link.unregisterDevice();
  await link.registerDevice(device);
  await link.retryPending();

  expect(register).not.toHaveBeenCalled();
});

it("records a logout's unlink at once and runs it past a stalled registration", async () => {
  const { link, stored, unregister, signOut } = setUp({
    requestDeadlineMs: 20,
  });
  stored.set(SecureStorageKey.DEVICE_ID, "device-1");
  stored.set(SecureStorageKey.REGISTERED_TOKEN, "token-a");

  const registered = link.registerDevice(device);
  await tick();
  const unlinked = link.unregisterDevice();
  signOut();
  await tick();
  expect(stored.get(SecureStorageKey.UNLINK_PENDING)).toBe("true");
  expect(unregister).not.toHaveBeenCalled();

  await Promise.all([registered, unlinked]);
  expect(unregister).toHaveBeenCalledWith({
    deviceId: "device-1",
    expoPushToken: "token-a",
  });
  expect(stored.get(SecureStorageKey.UNLINK_PENDING)).toBeUndefined();
});

it("keeps a logout's unlink pending through a registration that lands after it", async () => {
  const { link, stored, unregister, releaseRegister, signOut } = setUp({
    requestDeadlineMs: 20,
  });
  unregister.mockImplementationOnce(() => new Promise<void>(() => {}));

  const registered = link.registerDevice(device);
  await tick();
  const unlinked = link.unregisterDevice();
  signOut();
  releaseRegister("device-1");
  await Promise.all([registered, unlinked]);

  expect(stored.get(SecureStorageKey.DEVICE_ID)).toBe("device-1");
  expect(stored.get(SecureStorageKey.UNLINK_PENDING)).toBe("true");
});

it("reports a failed unlink unless the phone is offline or the request timed out", async () => {
  __resetAnalyticsForTests();
  const captured: unknown[] = [];
  registerAnalytics({
    capture: () => {},
    captureException: (error) => void captured.push(error),
  });
  const { link, stored, unregister } = setUp({ requestDeadlineMs: 20 });
  stored.set(SecureStorageKey.DEVICE_ID, "device-1");
  stored.set(SecureStorageKey.REGISTERED_TOKEN, "token-a");
  const refused = new Error("500");
  unregister
    .mockImplementationOnce(() =>
      Promise.reject(new Error("fetch failed: offline")),
    )
    .mockImplementationOnce(() => new Promise<void>(() => {}))
    .mockImplementationOnce(() => Promise.reject(refused));

  await link.unregisterDevice();
  await link.retryPending();
  await link.retryPending();

  expect(unregister).toHaveBeenCalledTimes(3);
  expect(captured).toEqual([refused]);
});

it("unlinks a registration that lands past its deadline after sign-out", async () => {
  const { link, stored, unregister, releaseRegister, signOut } = setUp({
    requestDeadlineMs: 20,
  });

  await link.registerDevice(device);
  signOut();
  await link.unregisterDevice();
  expect(unregister).not.toHaveBeenCalled();

  releaseRegister("device-1");
  await tick();
  await link.retryPending();

  expect(unregister).toHaveBeenCalledWith({
    deviceId: "device-1",
    expoPushToken: "token-a",
  });
  expect(stored.get(SecureStorageKey.UNLINK_PENDING)).toBeUndefined();
});

it("relinks the session signed in since a late registration it unlinks", async () => {
  const {
    link,
    stored,
    register,
    unregister,
    releaseRegister,
    signOut,
    signIn,
  } = setUp({ requestDeadlineMs: 20 });

  await link.registerDevice(device);
  signOut();
  await link.unregisterDevice();
  signIn(2);
  register.mockImplementation(async () => "device-2");
  await link.registerDevice({ ...device, session: 2 });

  releaseRegister("device-1");
  await tick();
  await link.retryPending();

  expect(unregister).toHaveBeenCalledWith({
    deviceId: "device-1",
    expoPushToken: "token-a",
  });
  expect(register).toHaveBeenCalledTimes(3);
  expect(stored.get(SecureStorageKey.DEVICE_ID)).toBe("device-2");
});

it("stores a late registration within its own session as the link", async () => {
  const { link, stored, register, unregister, releaseRegister } = setUp({
    requestDeadlineMs: 20,
  });

  await link.registerDevice(device);
  releaseRegister("device-1");
  await tick();
  expect(stored.get(SecureStorageKey.DEVICE_ID)).toBe("device-1");
  await link.retryPending();

  expect(unregister).not.toHaveBeenCalled();
  expect(register).toHaveBeenCalledTimes(1);
});

it("unlinks a late registration within its own session at logout", async () => {
  const { link, unregister, releaseRegister, signOut } = setUp({
    requestDeadlineMs: 20,
  });

  await link.registerDevice(device);
  releaseRegister("device-1");
  await tick();
  signOut();
  await link.unregisterDevice();

  expect(unregister).toHaveBeenCalledWith({
    deviceId: "device-1",
    expoPushToken: "token-a",
  });
});

it("drops a pending unlink once a late registration links the new sign-in", async () => {
  const { link, stored, unregister, releaseRegister, signOut, signIn } = setUp({
    requestDeadlineMs: 20,
  });
  stored.set(SecureStorageKey.DEVICE_ID, "device-1");
  stored.set(SecureStorageKey.REGISTERED_TOKEN, "token-a");
  unregister.mockImplementationOnce(() => Promise.reject(new Error("offline")));
  signOut();
  await link.unregisterDevice();
  signIn(2);

  await link.registerDevice({ ...device, session: 2 });
  releaseRegister("device-1");
  await tick();
  await link.retryPending();

  expect(unregister).toHaveBeenCalledTimes(1);
});

it("keeps the retry's link over a registration that lands after it", async () => {
  const { link, stored, register, releaseRegister } = setUp({
    requestDeadlineMs: 20,
  });

  await link.registerDevice(device);
  register.mockImplementationOnce(async () => "device-2");
  await link.retryPending();
  releaseRegister("device-1");
  await tick();

  expect(stored.get(SecureStorageKey.DEVICE_ID)).toBe("device-2");
});

it("relinks the session signed in since a late registration whose unlink fails", async () => {
  const {
    link,
    stored,
    register,
    unregister,
    releaseRegister,
    signOut,
    signIn,
  } = setUp({ requestDeadlineMs: 20 });

  await link.registerDevice(device);
  signOut();
  await link.unregisterDevice();
  signIn(2);
  register.mockImplementation(async () => "device-2");
  await link.registerDevice({ ...device, session: 2 });
  unregister.mockImplementationOnce(() =>
    Promise.reject(new TypeError("Network request failed")),
  );

  releaseRegister("device-1");
  await tick();
  await link.retryPending();

  expect(register).toHaveBeenCalledTimes(3);
  expect(stored.get(SecureStorageKey.DEVICE_ID)).toBe("device-2");
});

it("retries the current session's failed registration past a stale one", async () => {
  const { link, register, signOut, signIn } = setUp();

  signOut();
  signIn(2);
  register.mockImplementationOnce(() =>
    Promise.reject(new TypeError("Network request failed")),
  );
  await link.registerDevice({ ...device, session: 2 });
  await link.registerDevice(device);
  await link.retryPending();

  expect(register).toHaveBeenCalledTimes(2);
});

it("unlinks even when recording the pending unlink fails", async () => {
  const { link, stored, unregister } = setUp({ failWrites: true });
  stored.set(SecureStorageKey.DEVICE_ID, "device-1");
  stored.set(SecureStorageKey.REGISTERED_TOKEN, "token-a");

  await link.unregisterDevice();

  expect(unregister).toHaveBeenCalledWith({
    deviceId: "device-1",
    expoPushToken: "token-a",
  });
});

const fakeLink = () => ({
  registerDevice: mock(async () => {}),
  unregisterDevice: mock(async () => {}),
  retryPending: mock(async () => {}),
});

it("links and unlinks through the active session's deployment", async () => {
  const binary = fakeLink();
  const review = fakeLink();
  let reviewing = true;
  const links = sessionDeviceLinks({
    binary,
    review,
    isReviewSession: () => reviewing,
  });
  await links.registerDevice(device);
  await links.unregisterDevice();
  reviewing = false;
  await links.unregisterDevice();

  expect(review.registerDevice).toHaveBeenCalledWith(device);
  expect(review.unregisterDevice).toHaveBeenCalledTimes(1);
  expect(binary.registerDevice).not.toHaveBeenCalled();
  expect(binary.unregisterDevice).toHaveBeenCalledTimes(1);
});

it.each([true, false])(
  "retries both deployments' pending steps (review session: %p)",
  async (reviewing) => {
    const binary = fakeLink();
    const review = fakeLink();

    await sessionDeviceLinks({
      binary,
      review,
      isReviewSession: () => reviewing,
    }).retryPending();

    expect(binary.retryPending).toHaveBeenCalledTimes(1);
    expect(review.retryPending).toHaveBeenCalledTimes(1);
  },
);
