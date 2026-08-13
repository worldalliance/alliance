import TurndownService from "turndown";

const BOLD_FONT_WEIGHT = /font-weight:\s*(bold|bolder|[6-9]\d{2}|1000)\b/i;
const NORMAL_FONT_WEIGHT = /font-weight:\s*(normal|lighter|[1-5]\d{2})\b/i;
const ITALIC_FONT_STYLE = /font-style:\s*italic/i;

const EMPHASIS_TAGS = ["SPAN", "FONT", "B", "STRONG", "I", "EM"];

function styleOf(node: HTMLElement): string {
  return node.getAttribute("style") ?? "";
}

// Google Docs wraps its entire payload in <b style="font-weight:normal">, which
// would otherwise bold the whole paste.
function isBold(node: HTMLElement): boolean {
  return node.nodeName === "B" || node.nodeName === "STRONG"
    ? !NORMAL_FONT_WEIGHT.test(styleOf(node))
    : BOLD_FONT_WEIGHT.test(styleOf(node));
}

function isItalic(node: HTMLElement): boolean {
  return (
    node.nodeName === "I" ||
    node.nodeName === "EM" ||
    ITALIC_FONT_STYLE.test(styleOf(node))
  );
}

// Google Docs restates the same weight on nested spans, so only the outermost
// element expressing it emits a delimiter — otherwise we'd write ****text****.
function isInherited(
  node: HTMLElement,
  expresses: (node: HTMLElement) => boolean,
): boolean {
  for (let p = node.parentElement; p; p = p.parentElement) {
    if (expresses(p)) return true;
  }
  return false;
}

function isBlockNode(node: HTMLElement): boolean {
  return "isBlock" in node && node.isBlock === true;
}

const service = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  // An empty <li> — the trailing bullet people leave behind in a doc — would
  // otherwise emit a paragraph break, and a single blank line inside a list
  // makes every item render as its own paragraph.
  blankReplacement: (_content, node) =>
    node.nodeName === "LI" ? "" : isBlockNode(node) ? "\n\n" : "",
});

service.remove(["style", "script"]);

// Pasting a Docs image would otherwise inline a base64 data URI, or a
// googleusercontent link that expires, into the body text. `remove` doesn't
// cover it — turndown's built-in image rule is matched first.
service.addRule("image", { filter: "img", replacement: () => "" });

// Google Docs expresses emphasis as inline styles on <span> rather than <b>/<i>.
service.addRule("emphasis", {
  filter: (node) => EMPHASIS_TAGS.includes(node.nodeName),
  replacement: (content, node) => {
    // A blank line means the tag wrapped block content — a Docs payload
    // wrapper, or bold around a list. Delimiters can't span that, so they'd
    // render as literal asterisks on their own lines.
    if (!content.trim() || content.includes("\n\n")) return content;

    let out = content;
    if (isItalic(node) && !isInherited(node, isItalic)) out = `*${out}*`;
    if (isBold(node) && !isInherited(node, isBold)) out = `**${out}**`;
    return out;
  },
});

// Skips blank items, which render as nothing, and any non-<li> child, so the
// numbering matches what the list actually emits.
function itemNumber(list: HTMLElement, item: HTMLElement): number {
  const start = Number.parseInt(list.getAttribute("start") ?? "", 10);
  const items = [...list.children].filter(
    (child) => child.nodeName === "LI" && child.textContent?.trim(),
  );

  return (Number.isNaN(start) ? 1 : start) + items.indexOf(item);
}

// Turndown pads markers out to four columns and leaves a blank line between
// items whose text Google Docs wrapped in its own <p>. The result lands in a
// textarea people hand-edit, so keep it narrow and tight instead.
service.addRule("listItem", {
  filter: "li",
  replacement: (content, node) => {
    const parent = node.parentElement;
    const marker =
      parent?.nodeName === "OL" ? `${itemNumber(parent, node)}. ` : "- ";
    // Continuation lines have to clear the marker for a nested list to nest.
    const body = content
      .trim()
      .replace(/\n/g, `\n${" ".repeat(marker.length)}`);

    return marker + body + (node.nextSibling ? "\n" : "");
  },
});

export function htmlToMarkdownFromDocs(html: string): string {
  return service
    .turndown(html)
    .replace(/\u00a0/g, " ")
    .replace(/^[ \t]+$/gm, "")
    .trim();
}
