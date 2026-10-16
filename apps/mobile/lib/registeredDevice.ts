// eslint-disable-next-line api-client/named-hooks-only -- one-off request whose result no query cache holds
import {
  userRegisterDevice,
  userUnregisterDevice,
} from "@alliance/shared/client";
import { milliseconds } from "date-fns";
import { getBinaryApiUrl, isReviewSession } from "./config";
import { createDeviceLink, sessionDeviceLinks } from "./deviceLink";
import { STAGING } from "./releaseTarget";
import { ReviewSecureStorage, SecureStorage } from "./SecureStorage";
import { currentSession } from "./session";

const deviceLink = (params: {
  storage: typeof SecureStorage;
  baseUrl: () => string;
}) =>
  createDeviceLink({
    storage: params.storage,
    register: async (body) =>
      (
        await userRegisterDevice({
          body: { ...body, taskBadgePushes: true },
          baseUrl: params.baseUrl(),
          throwOnError: true,
        })
      ).data.id,
    unregister: async (body) => {
      await userUnregisterDevice({
        body,
        baseUrl: params.baseUrl(),
        // A retry can unlink the other deployment's device, which must not see
        // this session's token; the endpoint is public.
        headers: { Authorization: null },
        throwOnError: true,
      });
    },
    currentSession,
    requestDeadlineMs: milliseconds({ seconds: 30 }),
  });

export const { registerDevice, unregisterDevice, retryPending } =
  sessionDeviceLinks({
    binary: deviceLink({ storage: SecureStorage, baseUrl: getBinaryApiUrl }),
    review: deviceLink({
      storage: ReviewSecureStorage,
      baseUrl: () => STAGING.apiUrl,
    }),
    isReviewSession,
  });
