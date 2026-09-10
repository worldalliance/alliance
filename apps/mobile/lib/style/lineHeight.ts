import type { TextStyle } from "react-native";

/**
 * Adjusts an unscaled line height so that `lineHeight * fontScale`, the value
 * iOS lays the paragraph out at, lands on a whole point. Off the pixel grid,
 * iOS clips the paragraph's last line.
 *
 * Assumes the default `allowFontScaling` and no `maxFontSizeMultiplier`. With
 * either overridden iOS scales by a different multiplier, and the product is
 * fractional again.
 */
export function lineHeightForWholePoints({
  lineHeight,
  fontScale,
}: {
  lineHeight: number;
  fontScale: number;
}): number {
  // Absorb the float residue a previous division left behind, so re-rounding an
  // already-rounded height stays put instead of gaining another whole point.
  return Math.ceil(lineHeight * fontScale - 1e-9) / fontScale;
}

/**
 * uniwind multiplies a unitless line height by the font size without checking
 * that one resolved, so a class string carrying no `text-*` size answers NaN.
 * Dropping the key rather than the value keeps the contract callers read: a
 * style that sets no line height leaves it absent, and so does one whose height
 * didn't resolve.
 */
export function wholePointStyle({
  style,
  fontScale,
  classNames,
}: {
  style: TextStyle;
  fontScale: number;
  classNames: string;
}): TextStyle {
  // Web answers a CSS string, which is a real line height there.
  if (typeof style.lineHeight !== "number") {
    return style;
  }

  const { lineHeight, ...rest } = style;
  const rounded = lineHeightForWholePoints({ lineHeight, fontScale });

  if (Number.isFinite(rounded)) {
    return { ...rest, lineHeight: rounded };
  }

  if (__DEV__) {
    console.warn(
      `[style] dropped the line height for "${classNames}". ${lineHeight} at scale ${fontScale} doesn't round to a number, and a unitless leading-* with no text-* size answers NaN.`,
    );
  }

  return rest;
}
