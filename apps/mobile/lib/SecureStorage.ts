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

/** {@link SecureStorage} under keys of its own, for what a review session
 * keeps apart from the binary's deployment. */
export const ReviewSecureStorage: typeof SecureStorage = {
  setItem: (key, value, options) =>
    secureStorageBackend.setItem(`review.${key}`, value, options),
  getItem: (key, options) =>
    secureStorageBackend.getItem(`review.${key}`, options),
  deleteItem: (key, options) =>
    secureStorageBackend.deleteItem(`review.${key}`, options),
};

export const getAccessToken = () =>
  SecureStorage.getItem(SecureStorageKey.ACCESS_TOKEN);
export const getRefreshToken = () =>
  SecureStorage.getItem(SecureStorageKey.REFRESH_TOKEN);

export const saveSessionTokens = async ({ access, refresh }: SessionTokens) => {
  await SecureStorage.setItem(SecureStorageKey.ACCESS_TOKEN, access);
  await SecureStorage.setItem(SecureStorageKey.REFRESH_TOKEN, refresh);
};
