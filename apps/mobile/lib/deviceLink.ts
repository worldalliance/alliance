import { ExceptionEvent } from "@alliance/common/analytics";
import { TIMED_OUT, withTimeout } from "@alliance/common/timeout";
import type {
  RegisterDeviceDto,
  UnregisterDeviceDto,
} from "@alliance/shared/client";
import { captureException } from "@alliance/shared/lib/analytics";
import { isNetworkFailure } from "./network";
import type { SecureStorage } from "./SecureStorage";
import { SecureStorageKey } from "./secureStorageKey";

type DeviceLinkDeps = {
  storage: Pick<typeof SecureStorage, "getItem" | "setItem" | "deleteItem">;
  register: (body: RegisterDeviceDto) => Promise<string>;
  unregister: (body: UnregisterDeviceDto) => Promise<void>;
  currentSession: () => number | undefined;
  requestDeadlineMs: number;
};

class RequestTimedOutError extends Error {}

/**
 * Links this device to the signed-in account and unlinks it on sign-out.
 * Each step runs after the last has settled and reads the storage it wrote,
 * so an unlink can't miss a registration in flight, nor delete the row a
 * later one linked. An unlink stays pending until the server confirms it or
 * a registration replaces it. A failed registration is retried ahead of a
 * pending unlink, so the retry can't unlink the account now signed in. A
 * registration is dropped once the session it was requested in has closed.
 * A request past its deadline fails its step, so a stalled one can't hold
 * back the steps behind it. A registration that lands past its deadline is
 * stored as the link while its session is open and it awaits a retry; after
 * its session closed, it is unlinked and the session open since relinked.
 */
export function createDeviceLink(deps: DeviceLinkDeps) {
  const { storage } = deps;
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (step: () => Promise<void>): Promise<void> => {
    const run = queue.then(step);
    queue = run.catch(() => {});
    return run;
  };

  const withinDeadline = async <T>(request: Promise<T>): Promise<T> => {
    const result = await withTimeout(request, deps.requestDeadlineMs);
    if (result === TIMED_OUT) {
      throw new RequestTimedOutError("device link request timed out");
    }
    return result;
  };

  const unlink = async () => {
    const [deviceId, expoPushToken] = await Promise.all([
      storage.getItem(SecureStorageKey.DEVICE_ID),
      storage.getItem(SecureStorageKey.REGISTERED_TOKEN),
    ]);
    if (deviceId && expoPushToken) {
      await withinDeadline(deps.unregister({ deviceId, expoPushToken }));
    }
    await storage.deleteItem(SecureStorageKey.UNLINK_PENDING);
  };

  const reportingUnlinkFailure = (step: () => Promise<void>) => () =>
    step().catch((error: unknown) => {
      console.error("failed to unregister the push device", error);
      // Offline, the unlink fails on every retry until the phone reconnects.
      if (
        !isNetworkFailure(error) &&
        !(error instanceof RequestTimedOutError)
      ) {
        captureException(ExceptionEvent.UnregisterDeviceFailed, error);
      }
    });

  type RegisterParams = Pick<RegisterDeviceDto, "deviceType" | "expoPushToken">;
  type Registration = { params: RegisterParams; session: number | undefined };
  let failedRegistration: Registration | null = null;
  let latestRegistration: Registration | null = null;

  const storeLink = async (deviceId: string, params: RegisterParams) => {
    await storage.setItem(SecureStorageKey.DEVICE_ID, deviceId);
    await storage.setItem(
      SecureStorageKey.REGISTERED_TOKEN,
      params.expoPushToken,
    );
  };

  const landedLate = async (deviceId: string, registration: Registration) => {
    if (registration.session === deps.currentSession()) {
      // Once a retry has run, its own link supersedes this one.
      if (failedRegistration === registration) {
        await storeLink(deviceId, registration.params);
        await storage.deleteItem(SecureStorageKey.UNLINK_PENDING);
        failedRegistration = null;
      }
      return;
    }
    await storeLink(deviceId, registration.params);
    await storage.setItem(SecureStorageKey.UNLINK_PENDING, "true");
    try {
      await unlink();
    } finally {
      const latest = latestRegistration;
      if (latest && latest.session === deps.currentSession()) {
        await register(latest);
      }
    }
  };

  const register = async (registration: Registration): Promise<void> => {
    const { params, session } = registration;
    if (session !== deps.currentSession()) {
      if (failedRegistration === registration) failedRegistration = null;
      return;
    }
    latestRegistration = registration;
    try {
      const storedId = await storage.getItem(SecureStorageKey.DEVICE_ID);
      const request = deps.register({
        ...params,
        deviceId: storedId ?? undefined,
      });
      const deviceId = await withinDeadline(request).catch((error: unknown) => {
        if (error instanceof RequestTimedOutError) {
          void request.then(
            (lateId) =>
              enqueue(
                reportingUnlinkFailure(() => landedLate(lateId, registration)),
              ),
            () => {},
          );
        }
        throw error;
      });
      await storeLink(deviceId, params);
      // A sign-out during the request has recorded an unlink this mustn't drop.
      if (session === deps.currentSession()) {
        await storage.deleteItem(SecureStorageKey.UNLINK_PENDING);
      }
      failedRegistration = null;
    } catch (error) {
      failedRegistration = registration;
      console.error("push device registration failed", error);
    }
  };

  return {
    /** `session` is the one open when the push token lookup started. */
    registerDevice: (registration: Registration): Promise<void> =>
      enqueue(() => register(registration)),

    /**
     * Needs no session: the server matches the stored device id and push token.
     * Records the unlink at once, so it survives the app closing while an
     * earlier step is still running.
     */
    unregisterDevice: (): Promise<void> => {
      const recorded = storage.setItem(SecureStorageKey.UNLINK_PENDING, "true");
      void recorded.catch(() => {});
      return enqueue(() => {
        failedRegistration = null;
        return reportingUnlinkFailure(async () => {
          await recorded.catch((error: unknown) =>
            console.error("failed to record the pending unlink", error),
          );
          await unlink();
        })();
      });
    },

    retryPending: (): Promise<void> =>
      enqueue(
        reportingUnlinkFailure(async () => {
          if (failedRegistration) {
            await register(failedRegistration);
          } else if (await storage.getItem(SecureStorageKey.UNLINK_PENDING)) {
            await unlink();
          }
        }),
      ),
  };
}

type DeviceLink = ReturnType<typeof createDeviceLink>;

/** Routes to the active session's deployment's link, so one deployment's
 * device id never stands in for, or unlinks, the other's. A retry covers both,
 * so an unlink pending from the other deployment's session still lands. */
export const sessionDeviceLinks = (params: {
  binary: DeviceLink;
  review: DeviceLink;
  isReviewSession: () => boolean;
}) => {
  const active = () =>
    params.isReviewSession() ? params.review : params.binary;
  return {
    registerDevice: (
      registration: Parameters<DeviceLink["registerDevice"]>[0],
    ) => active().registerDevice(registration),
    unregisterDevice: (): Promise<void> => active().unregisterDevice(),
    retryPending: async (): Promise<void> => {
      await Promise.all([
        params.binary.retryPending(),
        params.review.retryPending(),
      ]);
    },
  };
};
