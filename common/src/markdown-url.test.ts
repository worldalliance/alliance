import { safeMarkdownUrl } from "./markdown-url";

const apiUrl = "https://thealliance.org/api";

describe("safeMarkdownUrl", () => {
  it("resolves an upload key in an image source", () => {
    expect(
      safeMarkdownUrl({
        url: "abc.png",
        attribute: "src",
        tagName: "img",
        apiUrl,
      }),
    ).toBe("https://thealliance.org/api/images/abc.png");
  });

  it("leaves a slash-free link href alone", () => {
    expect(
      safeMarkdownUrl({
        url: "abc.png",
        attribute: "href",
        tagName: "a",
        apiUrl,
      }),
    ).toBe("abc.png");
  });

  it.each([
    ["src", "img"],
    ["href", "a"],
  ])("rejects a javascript: %s", (attribute, tagName) => {
    expect(
      safeMarkdownUrl({
        url: "javascript:alert(1)",
        attribute,
        tagName,
        apiUrl,
      }),
    ).toBe("");
  });
});
