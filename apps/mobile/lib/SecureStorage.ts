import { secureStorageBackend } from "./secureStorageBackend";
import type { SecureStoreOptions } from "./secureStorageBackendContract";
import { SecureStorageKey } from "./secureStorageKey";

export { SecureStorageKey };

export type SessionTokens = { access: string; refresh: string };

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

export const getAccessToken = () =>
  SecureStorage.getItem(SecureStorageKey.ACCESS_TOKEN);
export const getRefreshToken = () =>
  SecureStorage.getItem(SecureStorageKey.REFRESH_TOKEN);

export const saveSessionTokens = async ({ access, refresh }: SessionTokens) => {
  await SecureStorage.setItem(SecureStorageKey.ACCESS_TOKEN, access);
  await SecureStorage.setItem(SecureStorageKey.REFRESH_TOKEN, refresh);
};
