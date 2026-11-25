const PALETTE = [
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald",
  "teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white",
  // The first `@theme` block in `src/index.css`, which styles member content.
  "page|greentext|ambassador|grouplead",
].join("|");
const COLOR_UTILITY =
  "bg|text|border(?:-[xytrblse])?|divide|outline|ring|ring-offset|inset-ring|shadow|inset-shadow|drop-shadow|text-shadow|from|via|to|fill|stroke|decoration|accent|caret|placeholder";
const RAW_COLOR = new RegExp(
  `^!?(?:${COLOR_UTILITY})-(?:${PALETTE})(?:-\\d{1,3})?(?:/[\\w.[\\]%-]+)?!?$`,
);
const ARBITRARY_VALUE =
  /^!?-?[a-z][a-z0-9-]*-(?:\[[^\]]+\]|\((?:[a-z-]+:)?--[^)]+\))/;
const ARBITRARY_PROPERTY = /^!?\[[a-z-]+:[^\]]+\]!?$/;
const ARBITRARY_MODIFIER = /^!?-?[a-z][a-z0-9-]*\/(?:\[[^\]]+\]|\([^)]+\))/;
const ARBITRARY_BREAKPOINT = /(?:^|:)(?:min|max)-\[/;
// A template that builds the value: `w-[${width}px]`.
const OPEN_BRACKET = /(?:^|\s)!?-?[a-z][a-z0-9:-]*[-/]\[$/;

/** The utility of a class, after its variants: `hover:data-[x=y]:p-2` gives `p-2`. */
export function utilityOf(className) {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < className.length; i++) {
    const char = className[i];
    if (char === "[" || char === "(") depth++;
    else if (char === "]" || char === ")") depth--;
    else if (char === ":" && depth === 0) start = i + 1;
  }
  return className.slice(start);
}

/** Why a class breaks the admin's tokens-only rule, or `null`. */
export function classProblem(className) {
  const utility = utilityOf(className);
  if (RAW_COLOR.test(utility)) return "rawColor";
  const variants = className.slice(0, className.length - utility.length);
  if (
    ARBITRARY_VALUE.test(utility) ||
    ARBITRARY_PROPERTY.test(utility) ||
    ARBITRARY_MODIFIER.test(utility) ||
    ARBITRARY_BREAKPOINT.test(variants)
  ) {
    return "arbitraryValue";
  }
  return null;
}

const designTokens = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      rawColor:
        "`{{className}}` is a raw colour. Use a token from the admin's `@theme` block in src/index.css (bg-surface, text-fg-muted, border-line, …); apps/admin/DESIGN.md lists them.",
      arbitraryValue:
        "`{{className}}` is an arbitrary value. Use the token or Tailwind scale step for it; if none fits, ask for a token as apps/admin/DESIGN.md says.",
    },
  },
  create(context) {
    const check = (node, text) => {
      for (const className of text.split(/\s+/)) {
        const messageId = classProblem(className);
        if (messageId) context.report({ node, messageId, data: { className } });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        const text = node.value.cooked ?? "";
        check(node, text);
        const opened = node.tail ? null : OPEN_BRACKET.exec(text);
        if (opened) {
          context.report({
            node,
            messageId: "arbitraryValue",
            data: { className: `${opened[0].trim()}…]` },
          });
        }
      },
    };
  },
};

export default { rules: { "design-tokens": designTokens } };
