import { SecureStorage, SecureStorageKey } from "./SecureStorage";

export async function getStoredGuestToken(): Promise<string | null> {
  return SecureStorage.getItem(SecureStorageKey.GUEST_TOKEN);
}

export async function setStoredGuestToken(token: string): Promise<void> {
  await SecureStorage.setItem(SecureStorageKey.GUEST_TOKEN, token);
}

export async function clearGuestToken(): Promise<void> {
  await SecureStorage.deleteItem(SecureStorageKey.GUEST_TOKEN);
}
