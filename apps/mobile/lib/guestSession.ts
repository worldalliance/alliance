import { authCreateGuestSession } from "@alliance/shared/client";
import { SecureStorage, SecureStorageKey } from "./SecureStorage";

export async function ensureGuestToken(): Promise<string | null> {
  const stored = await SecureStorage.getItem(SecureStorageKey.GUEST_TOKEN);
  const { data } = await authCreateGuestSession({
    body: { mode: "header", guestToken: stored ?? undefined },
  });
  if (!data?.guestToken) {
    return null;
  }
  if (data.guestToken !== stored) {
    await SecureStorage.setItem(SecureStorageKey.GUEST_TOKEN, data.guestToken);
  }
  return data.guestToken;
}

export async function getStoredGuestToken(): Promise<string | null> {
  return SecureStorage.getItem(SecureStorageKey.GUEST_TOKEN);
}

export async function clearGuestToken(): Promise<void> {
  await SecureStorage.deleteItem(SecureStorageKey.GUEST_TOKEN);
}
