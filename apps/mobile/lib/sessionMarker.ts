import { R, type Result } from "@alliance/common/result";
import type { SecureStorage, SessionTokens } from "./SecureStorage";
import { SecureStorageKey } from "./secureStorageKey";
import {
  clearStoredTokens,
  currentSession,
  SessionOvertakenError,
} from "./session";

type Storage = Pick<typeof SecureStorage, "getItem" | "setItem" | "deleteItem">;

const clearTokens = (storage: Storage) =>
  clearStoredTokens(storage, [
    SecureStorageKey.ACCESS_TOKEN,
    SecureStorageKey.REFRESH_TOKEN,
  ]);

const clearMarker = (storage: Storage) =>
  clearStoredTokens(storage, [SecureStorageKey.REVIEW_SESSION]);

/** Throws rather than mark an earlier session's tokens for staging, or store
 * an ordinary session's beside a marker. A leftover unmarked token only reaches
 * the binary's deployment, which refuses a staging one. */
export const saveMarkedSession = async (
  storage: Storage,
  params: { tokens: SessionTokens; review: boolean },
): Promise<void> => {
  if (params.review) {
    R.unwrap(await clearTokens(storage));
    await storage.setItem(SecureStorageKey.REVIEW_SESSION, "true");
  } else {
    R.unwrap(await clearMarker(storage));
  }
  await storage.setItem(SecureStorageKey.ACCESS_TOKEN, params.tokens.access);
  await storage.setItem(SecureStorageKey.REFRESH_TOKEN, params.tokens.refresh);
};

/** Clears the marker only once the tokens are gone. A marker left without
 * tokens restores nothing, and the next save clears it, so its failure is
 * logged rather than failing the logout. */
export const clearMarkedSession = async (storage: Storage) => {
  const cleared = await clearTokens(storage);
  if (cleared.ok) {
    const marker = await clearMarker(storage);
    if (!marker.ok) {
      console.error("failed to clear the review marker", marker.error);
    }
  }
  return cleared;
};

/** Routes to the stored session's deployment before `restore` reads its tokens,
 * and back to the binary's when none restores. A login or logout that
 * overtakes the marker read routes itself. */
export const restoreMarkedSession = async <T>(params: {
  storage: Pick<Storage, "getItem">;
  setReviewSession: (review: boolean) => void;
  restore: () => Promise<Result<T | undefined, Error>>;
  reportFailure: (error: Error) => void;
}): Promise<Result<T | undefined, Error>> => {
  const restoring = currentSession();
  const marker = await R.fromPromise(
    params.storage.getItem(SecureStorageKey.REVIEW_SESSION),
  );
  if (currentSession() !== restoring) {
    return R.failure(new SessionOvertakenError());
  }
  if (!marker.ok) {
    params.reportFailure(marker.error);
    return marker;
  }
  params.setReviewSession(marker.value !== null);
  const restored = await params.restore();
  if (restored.ok && !restored.value) {
    params.setReviewSession(false);
  }
  return restored;
};

/** Routes to a new session's deployment before `open` loads its profile, and
 * back to the binary's when it fails to open. `open` saves the tokens through
 * the `saveTokens` it is handed, which stores the session's marker with them. */
export const openMarkedSession = async <T>(params: {
  storage: Storage;
  review: boolean;
  setReviewSession: (review: boolean) => void;
  open: (
    saveTokens: (tokens: SessionTokens) => Promise<void>,
  ) => Promise<Result<T, Error>>;
}): Promise<Result<T, Error>> => {
  params.setReviewSession(params.review);
  const opened = await params.open((tokens) =>
    saveMarkedSession(params.storage, { tokens, review: params.review }),
  );
  if (!opened.ok) {
    params.setReviewSession(false);
  }
  return opened;
};
