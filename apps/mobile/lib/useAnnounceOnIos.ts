import { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Announces `message` on iOS and does nothing on Android. Pair it with an
 * `accessibilityLiveRegion` view, which is what announces the message on
 * Android.
 */
export function useAnnounceOnIos(message?: string | null) {
  useEffect(() => {
    if (message && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}
