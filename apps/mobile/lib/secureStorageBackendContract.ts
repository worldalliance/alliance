import type { SecureStoreOptions } from "expo-secure-store";

export type { SecureStoreOptions };

export type SecureStorageBackend = {
  setItem: (
    key: string,
    value: string,
    options?: SecureStoreOptions,
  ) => Promise<void>;
  getItem: (
    key: string,
    options?: SecureStoreOptions,
  ) => Promise<string | null>;
  deleteItem: (key: string, options?: SecureStoreOptions) => Promise<void>;
};
