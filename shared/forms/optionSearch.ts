import { deburr } from "es-toolkit";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";

export const markdownPlainText = (markdown: string) =>
  toString(fromMarkdown(markdown));

export const fold = (text: string) => deburr(text).toLowerCase();

export function matchesOptionSearch(
  option: { label: string },
  query: string,
): boolean {
  return fold(option.label).includes(fold(query.trim()));
}
