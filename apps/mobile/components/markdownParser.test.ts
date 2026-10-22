import { commonMarkParser, markdownParser } from "./markdownParser";

function hrefs(source: string): string[] {
  return markdownParser
    .parseInline(source, {})
    .flatMap((token) => token.children ?? [])
    .filter((token) => token.type === "link_open")
    .map((token) => token.attrGet("href") ?? "");
}

describe("markdownParser", () => {
  test.each([
    ["see https://example.com/a", "https://example.com/a"],
    ["see www.example.com/path", "http://www.example.com/path"],
    ["visit www.example.org.", "http://www.example.org"],
    ["(www.example.org)", "http://www.example.org"],
    ['"www.example.org"', "http://www.example.org"],
    ["cdn.www.example.com", "http://www.example.com"],
    ["mail a@example.com", "mailto:a@example.com"],
  ])("links %p", (source, href) => {
    expect(hrefs(source)).toEqual([href]);
  });

  test.each([
    "I agree.It works",
    "Edit README.md",
    "see example.com",
    "awww.nice",
    "see //example.com/a",
    "ftp://example.com/f",
    "`https://example.com`",
  ])("leaves %p plain", (source) => {
    expect(hrefs(source)).toEqual([]);
  });
});

describe("commonMarkParser", () => {
  const inline = (source: string) =>
    commonMarkParser
      .parse(source, {})
      .flatMap((token) => token.children ?? [])
      .map((token) => [token.type, token.content]);

  test("joins a soft break's lines with a space", () => {
    expect(inline("one\ntwo")).toEqual([
      ["text", "one"],
      ["text", " "],
      ["text", "two"],
    ]);
  });

  test("keeps raw html as text", () => {
    expect(
      inline("Dear <Your Name>")
        .map(([, content]) => content)
        .join(""),
    ).toBe("Dear <Your Name>");
  });

  test("leaves bare urls and strikethrough as text", () => {
    expect(inline("~~old~~ https://example.org")).toEqual([
      ["text", "~~old~~ https://example.org"],
    ]);
  });
});
