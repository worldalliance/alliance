import {
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
  type SecureStoreOptions,
} from "expo-secure-store";

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
  ) => setItemAsync(key, value, options),
  getItem: (key: SecureStorageKey, options?: SecureStoreOptions) =>
    getItemAsync(key, options),
  deleteItem: (key: SecureStorageKey, options?: SecureStoreOptions) =>
    deleteItemAsync(key, options),
};
