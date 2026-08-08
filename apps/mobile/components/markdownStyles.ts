// The library's textgroup bypasses our Text primitive and its shrink default.
// These flex styles only apply when paragraph renders a View; wrappers that
// render paragraph as Text nest textgroup inline, where flex props do nothing.
export const MARKDOWN_FILL_WIDTH_STYLE = {
  textgroup: { flex: 1 },
};

/**
 * The library's full-width paragraph stretches chat bubbles, while its default
 * flexWrap disables flexShrink in Yoga. Each paragraph has one textgroup, so
 * nowrap preserves layout while allowing the bubble to shrink to fit.
 */
export const MARKDOWN_HUG_WIDTH_STYLE = {
  paragraph: {
    width: "auto" as const,
    flexWrap: "nowrap" as const,
    flexShrink: 1,
  },
  textgroup: { flexShrink: 1 },
};
