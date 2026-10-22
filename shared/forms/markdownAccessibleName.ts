import { fromMarkdown } from "mdast-util-from-markdown";

type MarkdownNode = ReturnType<typeof fromMarkdown>["children"][number];

function inlineText(node: MarkdownNode): string {
  switch (node.type) {
    case "break":
      return "\n";
    case "image":
    case "imageReference":
      return "";
  }
  if ("children" in node) return node.children.map(inlineText).join("");
  return "value" in node ? node.value : "";
}

function blockTexts(node: MarkdownNode): string[] {
  switch (node.type) {
    case "paragraph":
    case "heading":
      return [inlineText(node)];
  }
  const texts: string[] = [];
  if ("children" in node) {
    for (const child of node.children) texts.push(...blockTexts(child));
  }
  return texts;
}

/** Plain text of `markdown`, one line per block, so a screen reader pauses
 * between paragraphs and list items instead of running their words together. */
export function markdownAccessibleName(markdown: string): string | undefined {
  const name = fromMarkdown(markdown)
    .children.flatMap(blockTexts)
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .join("\n");
  return name.length > 0 ? name : undefined;
}
