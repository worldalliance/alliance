import { htmlToMarkdownFromDocs } from "./htmlToMarkdown";

const gdocsSpan = (text: string, weight: number) =>
  `<span style="font-size:11pt;font-family:Arial;font-weight:${weight};font-style:normal;vertical-align:baseline;white-space:pre-wrap;">${text}</span>`;

describe("htmlToMarkdownFromDocs", () => {
  test("moves trailing whitespace outside emphasis", () => {
    expect(htmlToMarkdownFromDocs("<p><b>title: </b>body</p>")).toBe(
      "**title:** body",
    );
    expect(
      htmlToMarkdownFromDocs("<p><strong>title:&nbsp;</strong>body</p>"),
    ).toBe("**title:** body");
  });

  test("reads emphasis from Google Docs inline styles", () => {
    const html = `<b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr">${gdocsSpan("Title: ", 700)}${gdocsSpan("body text", 400)}</p></b>`;

    expect(htmlToMarkdownFromDocs(html)).toBe("**Title:** body text");
  });

  test("converts bold and italic", () => {
    expect(htmlToMarkdownFromDocs("<p><em>hello </em>world</p>")).toBe(
      "*hello* world",
    );
    expect(
      htmlToMarkdownFromDocs(
        `<p><span style="font-weight:700;font-style:italic">both</span></p>`,
      ),
    ).toBe("***both***");
  });

  test("does not double up emphasis a tag and its style both express", () => {
    expect(
      htmlToMarkdownFromDocs(
        `<p><b><span style="font-weight:700">Note</span></b>: text</p>`,
      ),
    ).toBe("**Note**: text");
  });

  test("does not emphasize across a block boundary", () => {
    expect(
      htmlToMarkdownFromDocs(
        `<b id="docs-internal-guid-1"><p>${gdocsSpan("body text", 400)}</p></b>`,
      ),
    ).toBe("body text");
    expect(
      htmlToMarkdownFromDocs(
        "<strong><ul><li>first</li><li>second</li></ul></strong>",
      ),
    ).toBe("- first\n- second");
  });

  test("converts links", () => {
    expect(
      htmlToMarkdownFromDocs(
        `<p>see <a href="https://example.com/a">the link</a></p>`,
      ),
    ).toBe("see [the link](https://example.com/a)");
  });

  test("converts bullet lists", () => {
    const html = `<ul><li><b>One: </b>first</li><li>second</li></ul>`;

    expect(htmlToMarkdownFromDocs(html)).toBe("- **One:** first\n- second");
  });

  test("converts numbered lists", () => {
    expect(
      htmlToMarkdownFromDocs("<ol><li>first</li><li>second</li></ol>"),
    ).toBe("1. first\n2. second");
  });

  test("keeps list items tight when Google Docs wraps each one in a <p>", () => {
    const html = `<ul><li dir="ltr"><p dir="ltr"><b>One: </b>first</p></li><li dir="ltr"><p dir="ltr">second</p></li></ul>`;

    expect(htmlToMarkdownFromDocs(html)).toBe("- **One:** first\n- second");
  });

  // A blank line anywhere in a list makes every item render as its own
  // paragraph, so an empty item can't leave one behind.
  test("drops an empty list item without breaking the list or its numbering", () => {
    expect(
      htmlToMarkdownFromDocs("<ol><li>first</li><li></li><li>second</li></ol>"),
    ).toBe("1. first\n2. second");
  });

  test("indents a nested list past its parent's marker", () => {
    const html = `<ol><li>first<ul><li>nested</li></ul></li><li>second</li></ol>`;

    expect(htmlToMarkdownFromDocs(html)).toBe(
      "1. first\n   - nested\n2. second",
    );
  });
});
