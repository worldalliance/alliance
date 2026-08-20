import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";
import type { SecureStorageBackend } from "./secureStorageBackendContract";

export const secureStorageBackend = {
  setItem: setItemAsync,
  getItem: getItemAsync,
  deleteItem: deleteItemAsync,
} satisfies SecureStorageBackend;
