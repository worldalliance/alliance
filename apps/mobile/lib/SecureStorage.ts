import { secureStorageBackend } from "./secureStorageBackend";
import type { SecureStoreOptions } from "./secureStorageBackendContract";

export enum SecureStorageKey {
  ACCESS_TOKEN = "accessToken",
  REFRESH_TOKEN = "refreshToken",
  GUEST_TOKEN = "guestToken",
  DEVICE_ID = "deviceId",
  REGISTERED_TOKEN = "registeredToken",
}

export const SecureStorage = {
  setItem: (
    key: SecureStorageKey,
    value: string,
    options?: SecureStoreOptions,
  ) => secureStorageBackend.setItem(key, value, options),
  getItem: (key: SecureStorageKey, options?: SecureStoreOptions) =>
    secureStorageBackend.getItem(key, options),
  deleteItem: (key: SecureStorageKey, options?: SecureStoreOptions) =>
    secureStorageBackend.deleteItem(key, options),
};
