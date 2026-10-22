import {
  CopyTextFormat,
  type CopyTextBlock,
} from "@alliance/common/forms/display-blocks";
import { safeMarkdownUrl } from "@alliance/common/markdown-url";
import { siteHref, withOrigin } from "@alliance/common/url";
import type { Element, ElementContent, Nodes } from "hast";
import { toHtml } from "hast-util-to-html";
import { toText } from "hast-util-to-text";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toHast } from "mdast-util-to-hast";
import { visitParents } from "unist-util-visit-parents";
import type { ClipboardContent } from "../lib/clipboard";

export type ClipboardUrls = {
  apiUrl: string;
  /** Where site paths and links to either site domain point once pasted. */
  origin: string;
};

export function copyTextFormat(block: Pick<CopyTextBlock, "format">) {
  return block.format ?? CopyTextFormat.Plain;
}

function eachElement(
  tree: Nodes,
  visit: (element: Element, ancestors: Element[]) => void,
) {
  visitParents(tree, "element", (element, ancestors) =>
    visit(
      element,
      ancestors.filter((node): node is Element => node.type === "element"),
    ),
  );
}

const isAbsolute = (url: string) =>
  /^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith("//");

const isList = (element: Element) =>
  element.tagName === "ol" || element.tagName === "ul";

function resolveUrls(tree: Nodes, urls: ClipboardUrls) {
  eachElement(tree, (element) => {
    for (const attribute of ["href", "src"]) {
      const url = element.properties[attribute];
      if (typeof url !== "string") continue;
      const safe = safeMarkdownUrl({
        url,
        attribute,
        tagName: element.tagName,
        apiUrl: urls.apiUrl,
      });
      const resolved =
        safe && withOrigin({ url: siteHref(safe), origin: urls.origin });
      // An anchor or page-relative URL leads nowhere once pasted off the site.
      const kept = resolved && isAbsolute(resolved) ? resolved : undefined;
      element.properties[attribute] = kept;
      if (attribute === "href" && kept && toText(element) === url) {
        element.children = [textNode(kept)];
      }
    }
  });
}

const textNode = (value: string): ElementContent => ({ type: "text", value });

function prependToItem(item: Element, marker: string) {
  const first = item.children.find((child) => child.type === "element");
  const target = first?.tagName === "p" ? first : item;
  target.children.unshift(textNode(marker));
}

/**
 * Spells out in text what the html carries in markup, so a paste into a
 * plain-text field keeps link targets, image sources, and list markers.
 */
function spellOutForPlainText(tree: Nodes) {
  eachElement(tree, (element, ancestors) => {
    const { href, src, alt, start } = element.properties;
    // A hard break's `<br>` already ends the line; the source newline after
    // it, even emptied, would come out as a leading space.
    element.children = element.children.flatMap((child, index) => {
      const previous = element.children[index - 1];
      if (child.type !== "text" || previous?.type !== "element") return [child];
      if (previous.tagName !== "br") return [child];
      const value = child.value.replace(/^\n/, "");
      return value ? [{ ...child, value }] : [];
    });
    if (element.tagName === "a" && typeof href === "string") {
      const label = toText(element);
      if (href !== label && href !== `mailto:${label}`) {
        element.children.push(textNode(` (${href})`));
      }
    }
    if (element.tagName === "img") {
      const label = typeof alt === "string" ? alt : "";
      const source = typeof src === "string" ? src : "";
      element.tagName = "span";
      element.children = [
        textNode(label && source ? `${label} (${source})` : label || source),
      ];
    }
    if (isList(element)) {
      // Non-breaking, since text rendering collapses leading spaces.
      const indent = "\u00a0\u00a0".repeat(ancestors.filter(isList).length);
      let number = typeof start === "number" ? start : 1;
      for (const item of element.children) {
        if (item.type !== "element" || item.tagName !== "li") continue;
        const marker = element.tagName === "ol" ? `${number++}. ` : "- ";
        prependToItem(item, indent + marker);
      }
    }
  });
}

export function copyTextClipboardContent(
  block: Pick<CopyTextBlock, "text" | "format">,
  urls: ClipboardUrls,
): ClipboardContent {
  const format = copyTextFormat(block);
  switch (format) {
    case CopyTextFormat.Plain:
      return { text: block.text };
    case CopyTextFormat.Markdown: {
      // Raw html stays as typed, as web renders it: a `<Your Name>` placeholder
      // is text, not a tag to drop.
      const tree = toHast(fromMarkdown(block.text), {
        handlers: {
          html: (_state, node) => ({ type: "text", value: node.value }),
        },
      });
      resolveUrls(tree, urls);
      const html = toHtml(tree);
      spellOutForPlainText(tree);
      return { text: toText(tree), html };
    }
    default:
      throw new Error(`unknown copy text format: ${format satisfies never}`);
  }
}
