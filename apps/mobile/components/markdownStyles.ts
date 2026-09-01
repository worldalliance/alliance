import { useMemo } from "react";
import { TextStyle, ViewStyle } from "react-native";
import { useResolveClassNames } from "uniwind";
import { colors } from "../lib/style/colors";
import { FontFamily, FontWeight, resolveFontFamily } from "./system/Text";

// The library renders leaf text with react-native's Text rather than our
// primitive, and the app sets no global font default, so anything that doesn't
// name a family here renders in the platform system font.
const SANS_FONT = resolveFontFamily(FontFamily.Sans, FontWeight.Regular);
// Weight travels via the family name, matching the primitive: the Source Sans
// faces are registered as separate families, so a bare `fontWeight` finds none
// of them and drops back to a synthesized or system bold.
const SANS_SEMIBOLD_FONT = {
  ...resolveFontFamily(FontFamily.Sans, FontWeight.Semibold),
  // Neutralize react-native-markdown-display's merged bold default; the
  // registered family carries the actual weight.
  fontWeight: "normal" as const,
};
// "monospace" resolves on Android only; iOS silently falls back to the system
// font, so go through the primitive's platform-aware family map.
const MONO_FONT = resolveFontFamily(FontFamily.Mono, FontWeight.Regular);

/**
 * The only markdown styles a caller may override. Text sizing is deliberately
 * excluded: the truncated-preview clamp reads the body style from this hook
 * rather than the merged result, so a caller-supplied `body` would desync it.
 * Size goes through `small` and color through `tone`.
 */
export type MarkdownLayoutStyle = {
  paragraph?: ViewStyle;
  textgroup?: ViewStyle;
};

// The library's textgroup bypasses our Text primitive and its shrink default.
// These flex styles only apply when paragraph renders a View; wrappers that
// render paragraph as Text nest textgroup inline, where flex props do nothing.
// A hardbreak splits a paragraph into several textgroups alongside the
// library's own `width: '100%'` hardbreak, so the basis must be 100% rather
// than `flex: 1`'s 0: at basis 0 every textgroup shares the hardbreak's line,
// which leaves the hardbreak holding the full width and each textgroup zero,
// rendering the text invisible but still tall.
export const MARKDOWN_FILL_WIDTH_STYLE = {
  textgroup: { flexGrow: 1, flexShrink: 1, flexBasis: "100%" },
} satisfies MarkdownLayoutStyle;

export enum MarkdownTone {
  Default = "default",
  Inverted = "inverted",
}

type MarkdownPalette = {
  text: string;
  caption: string;
  link: string;
  blockquoteBackground: string;
  blockquoteBorder: string;
  codeInlineBackground: string;
};

export const MARKDOWN_PALETTES: Record<MarkdownTone, MarkdownPalette> = {
  [MarkdownTone.Default]: colors.markdown.default,
  [MarkdownTone.Inverted]: colors.markdown.inverted,
};

// Keep this shape explicit: declaration emit cannot name uniwind's internal
// resolved-style type (TS2742).
export type MarkdownTextStyles = {
  body: TextStyle;
  bodySmall: TextStyle;
  heading1: TextStyle;
  heading2: TextStyle;
  heading3: TextStyle;
  heading4: TextStyle;
  heading5: TextStyle;
  heading6: TextStyle;
  strong: TextStyle;
  caption: TextStyle;
  code: TextStyle;
  codeInline: TextStyle;
};

export function useMarkdownTextStyles(): MarkdownTextStyles {
  const body = useResolveClassNames("text-base leading-normal");
  const bodySmall = useResolveClassNames("text-sm leading-normal");
  // Set heading line height explicitly because the renderer otherwise cascades
  // the body's looser line height into them.
  const heading1 = useResolveClassNames("text-xl leading-tight");
  const heading2 = useResolveClassNames("text-lg leading-tight");
  // Body size is the floor for headings. The renderer's own defaults put h4-h6
  // below it, which inverts the hierarchy, so h3 down all sit at body size and
  // are distinguished by weight alone.
  const headingFloor = useResolveClassNames("text-base leading-tight");
  const code = useResolveClassNames("text-sm");
  const caption = useResolveClassNames("text-xs");

  return useMemo(() => {
    const bodySizedHeading = { ...headingFloor, ...SANS_SEMIBOLD_FONT };

    return {
      body: { ...body, ...SANS_FONT },
      bodySmall: { ...bodySmall, ...SANS_FONT },
      heading1: { ...heading1, ...SANS_SEMIBOLD_FONT },
      heading2: { ...heading2, ...SANS_SEMIBOLD_FONT },
      heading3: bodySizedHeading,
      heading4: bodySizedHeading,
      heading5: bodySizedHeading,
      heading6: bodySizedHeading,
      strong: SANS_SEMIBOLD_FONT,
      caption: { ...caption, ...SANS_FONT },
      code: { ...code, ...MONO_FONT },
      codeInline: {
        ...code,
        ...MONO_FONT,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 2,
      },
    };
  }, [body, bodySmall, heading1, heading2, headingFloor, caption, code]);
}

/**
 * The library's full-width paragraph stretches chat bubbles, so width auto lets
 * the bubble hug its text. A hardbreak splits the paragraph into one textgroup
 * per line, which a column stacks and a row collapses to zero width. Nowrap
 * because Yoga's wrap disables flexShrink.
 */
export const MARKDOWN_HUG_WIDTH_STYLE = {
  paragraph: {
    width: "auto",
    flexDirection: "column",
    flexWrap: "nowrap",
    flexShrink: 1,
  },
  textgroup: { flexShrink: 1 },
} satisfies MarkdownLayoutStyle;
