import { useInvalidateActions } from "@alliance/shared/lib/actionsListPage";
import { useTaskBadgeMirror } from "@alliance/shared/lib/useTaskBadgeCount";
import { setBadgeCountAsync } from "expo-notifications";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { clearAndroidAppIconBadge } from "../modules/app-icon-badge";
import { writeAppIconBadge } from "./appIconBadge";
import { onAppActive } from "./onAppActive";

export const setAppIconBadge = (count: number): Promise<void> =>
  writeAppIconBadge({
    os: Platform.OS,
    count,
    set: setBadgeCountAsync,
    clearAndroid: clearAndroidAppIconBadge,
  });

/**
 * The Tasks badge count, mirrored onto the app icon while the app runs and
 * refetched whenever the app returns to the foreground.
 */
export function useTaskBadgeSync(): number | null {
  // Each fetch rewrites the icon even when the count is unchanged, since a
  // badge push applied in the background may have moved it off that count.
  const count = useTaskBadgeMirror(setAppIconBadge);
  const invalidateActions = useInvalidateActions();

  useEffect(
    () => onAppActive(AppState, invalidateActions),
    [invalidateActions],
  );

  return count;
}

/** Keeps the icon at zero while signed out, as a badge push can still land. */
export function useClearAppIconBadgeWhileSignedOut(signedOut: boolean): void {
  useEffect(() => {
    if (!signedOut) return;
    const clear = () => void setAppIconBadge(0);
    clear();
    return onAppActive(AppState, clear);
  }, [signedOut]);
}
