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

// Tailwind writes `line-height` from a `leading-*` utility, the `/<modifier>`
// on a `text-*` size, and an arbitrary `[line-height:...]`, and nowhere else.
// A bare `text-*` size can't, because `global.css` sets every
// `--text-*--line-height` to `initial` and adds no utility of its own. The `/`
// arm still sweeps in a `text-*` color's opacity modifier, which resolves for a
// cache hit and nothing else; telling that one from a size means tracking every
// name `global.css` adds.
const lineHeightUtility = /leading-|line-height|text-[^\s]*\//;

export function canSetLineHeight(classNames: string): boolean {
  return lineHeightUtility.test(classNames);
}

// uniwind gates a rule on the press state, `props.disabled`, and a `data-`
// attribute, none of which the resolve here passes it; every other variant it
// drops before the rule reaches the stylesheet. Both read off uniwind's
// `components/native/Text.tsx` and `metro/processor/processor.ts`, at the
// version `apps/mobile/package.json` pins. A bracketed `[&...]` counts too:
// Tailwind compiles `[&:active]` and `[&[data-selected=true]]` to the same
// nested rules those spell, so naming only the ones uniwind reads would pin a
// stale height for the next spelling.
const unresolvableVariant =
  /(?:^|[\s:])(?:active|disabled|\[&[^\s]*\]|data-\[[^\]]*\]|data-[a-z0-9-]+):/;

export function hasUnresolvableVariant(classNames: string): boolean {
  return unresolvableVariant.test(classNames);
}

const warnedClassNames = new Set<string>();

/** Drops the record of which class strings have warned, for tests. */
export function forgetLineHeightWarnings(): void {
  warnedClassNames.clear();
}

/**
 * The rounded line height to pin through the style prop, or null where pinning
 * it would be wrong.
 */
export function pinnableLineHeight({
  lineHeight,
  classNames,
}: {
  lineHeight: TextStyle["lineHeight"];
  classNames: string;
}): Pick<TextStyle, "lineHeight"> | null {
  // Ahead of the height check, so a variant carrying the only `leading-*` still
  // reports instead of falling out as a height that never resolved.
  if (hasUnresolvableVariant(classNames)) {
    // This runs on every render, so a Text with a variant on it would warn
    // once per row per frame.
    if (__DEV__ && !warnedClassNames.has(classNames)) {
      warnedClassNames.add(classNames);
      console.warn(
        `[style] didn't round the line height for "${classNames}". A variant on it (active:, disabled:, data-*, [&...]) could set a height this resolve can't see, and the rounded height would go in the style prop, which beats the class names. Pass a style lineHeight to set one yourself.`,
      );
    }

    return null;
  }

  if (!Number.isFinite(lineHeight)) {
    return null;
  }

  return { lineHeight };
}
