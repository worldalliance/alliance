import { CopyTextFormat } from "./display-blocks";
import { displayOnlyMarkdown } from "./display-only-markdown";
import type { DisplayOnlyBlock } from "./display-only-schema";

const markdownOf = (...blocks: DisplayOnlyBlock[]) =>
  displayOnlyMarkdown({ blocks, videoLink: "https://example.org/actions/1" });

describe("displayOnlyMarkdown", () => {
  it("keeps text blocks' Markdown and escapes plain-text fields", () => {
    expect(
      markdownOf(
        { type: "display", kind: "header", text: "*Results*" },
        { type: "display", kind: "text", text: "We **won**." },
        { type: "display", kind: "label", text: "1. not a list" },
        { type: "display", kind: "spacer" },
        { type: "display", kind: "divider" },
      ),
    ).toBe("## \\*Results\\*\n\nWe **won**.\n\n1\\. not a list\n\n---");
  });

  it("credits a quote's member, and links a big link", () => {
    expect(
      markdownOf(
        {
          type: "display",
          kind: "quote",
          text: "It *worked*.",
          userId: 7,
          userName: "Ana",
        },
        { type: "display", kind: "quote", text: "Anonymous", userId: 8 },
        {
          type: "display",
          kind: "header",
          text: "Next",
          level: 3,
        },
        { type: "display", kind: "biglink", text: "Discuss", url: "/forum" },
      ),
    ).toBe(
      "> **Ana**\n>\n> It *worked*.\n\n> **User #8**\n>\n> Anonymous\n\n### Next\n\n[Discuss](/forum)",
    );
  });

  it("gives each image its caption, and a video a link to where it plays", () => {
    expect(
      markdownOf(
        {
          type: "display",
          kind: "images",
          images: [{ src: "https://cdn.example.org/a b.webp", caption: "A" }],
        },
        { type: "display", kind: "video", src: "v.mp4", caption: "B" },
      ),
    ).toBe(
      "![](<https://cdn.example.org/a b.webp>)\n\n*A*\n\n[Watch the video](https://example.org/actions/1)\n\n*B*",
    );
  });

  it("quotes copy text, escaping it unless it's Markdown", () => {
    expect(
      markdownOf(
        { type: "display", kind: "copytext", title: "Say", text: "*hi*" },
        {
          type: "display",
          kind: "copytext",
          text: "*hi*\n\nthere",
          format: CopyTextFormat.Markdown,
        },
      ),
    ).toBe("Say\n\n> \\*hi\\*\n\n> *hi*\n>\n> there");
  });

  it("quotes a transcript with its speakers' names", () => {
    expect(
      markdownOf({
        type: "display",
        kind: "chatTranscript",
        leftName: "Store",
        messages: [
          { side: "left", text: "Hello" },
          { side: "left", text: "How can I help?" },
          { side: "right", text: "Doors?" },
        ],
      }),
    ).toBe("> **Store**\n>\n> Hello\n>\n> How can I help?\n>\n> Doors?");
  });

  it("opens every accordion section", () => {
    expect(
      markdownOf({
        type: "display",
        kind: "accordion",
        sections: [
          {
            title: "Why",
            blocks: [{ type: "display", kind: "text", text: "Because." }],
          },
        ],
      }),
    ).toBe("**Why**\n\nBecause.");
  });

  it("keeps an HTML block in one piece", () => {
    expect(
      markdownOf({
        type: "display",
        kind: "html",
        html: "<table>\n\n<tr><td>1</td></tr>\n  \n</table>",
      }),
    ).toBe("<table>\n<tr><td>1</td></tr>\n</table>");
  });
});
