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

const COLOR_LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(|^(?:white|black)$/i;
const FIXED_LENGTH = /\d(?:\.\d+)?(?:px|rem|em)\b/;
const COLOR_ATTRIBUTES = new Set([
  "fill",
  "stroke",
  "color",
  "stopColor",
  "floodColor",
  "lightingColor",
]);

/** The static text of a string or template literal; `null` for anything computed. */
function staticText(node) {
  if (node?.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (node?.type === "TemplateLiteral") {
    return node.quasis.map((quasi) => quasi.value.cooked ?? "").join(" ");
  }
  return null;
}

/** Why a value written in `style`, `fill` or `stroke` breaks the admin's tokens-only rule, or `null`. */
export function valueProblem(text, { layout }) {
  if (COLOR_LITERAL.test(text)) return "rawColorValue";
  if (layout && FIXED_LENGTH.test(text)) return "fixedLength";
  return null;
}

const designValues = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      rawColorValue:
        "`{{text}}` is a raw colour. Pass a token as a value (`var(--color-…)`, or the values in src/ui/charts/chartColor.ts), or use a class.",
      fixedLength:
        "`{{text}}` is a fixed length in `style`. Use a class on the token scale; `style` is for values computed from data.",
    },
  },
  create(context) {
    const report = (node, layout) => {
      const text = staticText(node);
      const messageId = text === null ? null : valueProblem(text, { layout });
      if (messageId) context.report({ node, messageId, data: { text } });
    };
    return {
      JSXAttribute(node) {
        const name = node.name.name;
        const value =
          node.value?.type === "JSXExpressionContainer"
            ? node.value.expression
            : node.value;
        if (COLOR_ATTRIBUTES.has(name)) report(value, false);
        if (name === "style" && value?.type === "ObjectExpression") {
          for (const property of value.properties) {
            if (property.type === "Property") report(property.value, true);
          }
        }
      },
    };
  },
};

export default {
  rules: { "design-tokens": designTokens, "design-values": designValues },
};
