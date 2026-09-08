import { useSyncExternalStore } from "react";
import { Dimensions, PixelRatio } from "react-native";
import { createFontScaleStore } from "./fontScaleStore";

const { subscribe, getSnapshot } = createFontScaleStore({
  read: () => PixelRatio.getFontScale(),
  // Never removed: one listener serves every caller for the app's lifetime.
  watch: (onChange) => {
    Dimensions.addEventListener("change", onChange);
  },
});

/** The OS text size multiplier, from a subscription shared by every caller. */
export function useFontScale(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
