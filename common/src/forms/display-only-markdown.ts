import { toMarkdown } from "mdast-util-to-markdown";
import {
  CopyTextFormat,
  groupChatTranscriptMessages,
  type NestedDisplayBlock,
} from "./display-blocks";
import type { DisplayOnlyBlock } from "./display-only-schema";

type Paragraph = Extract<
  Parameters<typeof toMarkdown>[0],
  { type: "paragraph" }
>;
type Phrasing = Paragraph["children"][number];

const inline = (...children: Phrasing[]): string =>
  toMarkdown({ type: "paragraph", children }).trimEnd();

const text = (value: string): Phrasing => ({ type: "text", value });

/** Plain text as Markdown that renders back to the same text. */
export const escapeMarkdownText = (value: string): string =>
  inline(text(value));

export const markdownLink = (params: { text: string; url: string }): string =>
  inline({ type: "link", url: params.url, children: [text(params.text)] });

const strong = (value: string) =>
  inline({ type: "strong", children: [text(value)] });

const caption = (value: string | undefined) =>
  value?.trim() ? inline({ type: "emphasis", children: [text(value)] }) : "";

const quoted = (markdown: string) =>
  markdown
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");

const joinBlocks = (parts: string[]) =>
  parts.filter((part) => part !== "").join("\n\n");

function blockMarkdown(params: {
  block: DisplayOnlyBlock | NestedDisplayBlock;
  videoLink: string;
}): string {
  const { block, videoLink } = params;
  switch (block.kind) {
    case "header":
      return `${"#".repeat(block.level ?? 2)} ${escapeMarkdownText(block.text)}`;
    case "text":
      return block.text;
    case "quote":
      return quoted(
        joinBlocks([
          block.userId === undefined
            ? ""
            : strong(block.userName ?? `User #${block.userId}`),
          block.text,
        ]),
      );
    case "label":
      return escapeMarkdownText(block.text);
    case "divider":
      return "---";
    case "spacer":
      return "";
    case "html":
      // A blank line ends a Markdown HTML block, and the rest would parse as Markdown.
      return block.html.replace(/\n\s*\n/g, "\n");
    case "images":
      return joinBlocks(
        block.images.flatMap((image) => [
          inline({ type: "image", url: image.src, alt: image.alt ?? "" }),
          caption(image.caption),
        ]),
      );
    case "video":
      return joinBlocks([
        markdownLink({ text: "Watch the video", url: videoLink }),
        caption(block.caption),
      ]);
    case "biglink":
      return markdownLink({ text: block.text, url: block.url });
    case "copytext":
      return joinBlocks([
        block.title ? escapeMarkdownText(block.title) : "",
        quoted(
          block.format === CopyTextFormat.Markdown
            ? block.text
            : escapeMarkdownText(block.text),
        ),
      ]);
    case "chatTranscript":
      return quoted(
        joinBlocks(
          groupChatTranscriptMessages(block.messages).flatMap((group) => {
            const name =
              group.side === "left" ? block.leftName : block.rightName;
            return [name?.trim() ? strong(name) : "", ...group.texts];
          }),
        ),
      );
    case "accordion":
      return joinBlocks(
        block.sections.flatMap((section) => [
          strong(section.title),
          ...section.blocks.map((nested) =>
            blockMarkdown({ block: nested, videoLink }),
          ),
        ]),
      );
    default:
      throw new Error(
        `unknown display block: ${JSON.stringify(block satisfies never)}`,
      );
  }
}

/**
 * Display-only content as one Markdown document, for channels that can't run
 * the block renderers. A video becomes a link to `videoLink`, where it plays.
 */
export function displayOnlyMarkdown(params: {
  blocks: DisplayOnlyBlock[];
  videoLink: string;
}): string {
  const { blocks, videoLink } = params;
  return joinBlocks(blocks.map((block) => blockMarkdown({ block, videoLink })));
}
