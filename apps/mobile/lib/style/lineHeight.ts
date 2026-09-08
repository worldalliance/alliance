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
