import {
  userRegisterDevice,
  userUnregisterDevice,
} from "@alliance/shared/client";
import { milliseconds } from "date-fns";
import { Platform } from "react-native";
import { createDeviceLink } from "./deviceLink";
import { SecureStorage } from "./SecureStorage";
import { currentSession } from "./session";

export const { registerDevice, unregisterDevice, retryPending } =
  createDeviceLink({
    storage: SecureStorage,
    register: async (body) =>
      (
        await userRegisterDevice({
          body: { ...body, taskBadgePushes: Platform.OS === "ios" },
          throwOnError: true,
        })
      ).data.id,
    unregister: async (body) => {
      await userUnregisterDevice({ body, throwOnError: true });
    },
    currentSession,
    requestDeadlineMs: milliseconds({ seconds: 30 }),
  });
