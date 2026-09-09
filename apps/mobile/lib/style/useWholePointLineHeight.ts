import { Platform, TextStyle } from "react-native";
import {
  canSetLineHeight,
  hasUnresolvableVariant,
  pinnableLineHeight,
} from "./lineHeight";
import { useFontScale } from "./useFontScale";
import { useWholePointClassNames } from "./useWholePointClassNames";

/**
 * The rounded line height a class string sets, ready for a Text's style prop,
 * or null where there is none to pin.
 */
export function useWholePointLineHeight(
  classNames: string,
): Pick<TextStyle, "lineHeight"> | null {
  const fontScale = useFontScale();
  // Web answers a CSS string and lays text out on its own subpixel grid, so
  // there is nothing to round there. uniwind's resolve is a lazy reducer plus a
  // layout effect, so a Text whose class names change renders a second time to
  // pick the new ones up; only a string that can answer a height pays that.
  const rounds = Platform.OS !== "web" && canSetLineHeight(classNames);
  // A variant gives its height up below, and uniwind won't cache a `data-*`
  // resolve, so skipping keeps that one off every render.
  const resolves = rounds && !hasUnresolvableVariant(classNames);
  const { lineHeight } = useWholePointClassNames(
    resolves ? classNames : "",
    fontScale,
  );

  return rounds ? pinnableLineHeight({ lineHeight, classNames }) : null;
}
