import { CopyTextFormat } from "@alliance/common/forms/display-blocks";
import { copyTextClipboardContent } from "./copyText";

const urls = {
  apiUrl: "https://thealliance.org/api",
  origin: "https://thealliance.org",
};

const markdown = (text: string) =>
  copyTextClipboardContent({ text, format: CopyTextFormat.Markdown }, urls);

describe("copyTextClipboardContent", () => {
  it("copies plain text verbatim, markdown syntax and all", () => {
    expect(
      copyTextClipboardContent({ text: "Use **bold** and #tags" }, urls),
    ).toEqual({ text: "Use **bold** and #tags" });
  });

  it("copies markdown as html plus a plain fallback without the syntax", () => {
    const content = markdown(
      "Dear **council**,\n\nPlease see [our letter](https://example.org).\n\n- one\n- two",
    );

    expect(content.html).toContain("<strong>council</strong>");
    expect(content.html).toContain(
      '<a href="https://example.org">our letter</a>',
    );
    expect(content.html).toContain("<li>one</li>");
    expect(content.text).toBe(
      "Dear council,\n\nPlease see our letter (https://example.org).\n\n- one\n- two",
    );
  });

  it("numbers ordered list items in the plain fallback", () => {
    expect(markdown("3. first\n4. second").text).toBe("3. first\n4. second");
    expect(markdown("1. first\n\n2. second").text).toBe(
      "1. first\n\n2. second",
    );
  });

  it("indents nested list items in the plain fallback", () => {
    expect(markdown("- a\n  1. b\n  2. c\n- d").text).toBe(
      "- a\n\u00a0\u00a01. b\n\u00a0\u00a02. c\n- d",
    );
  });

  it("starts the line after a hard break without a space", () => {
    expect(markdown("Sincerely,  \nJane\\\nOffice").text).toBe(
      "Sincerely,\nJane\nOffice",
    );
  });

  it("keeps a bare link once in the plain fallback", () => {
    expect(markdown("<https://example.org>").text).toBe("https://example.org");
    expect(markdown("<someone@example.org>").text).toBe("someone@example.org");
  });

  it("keeps raw html as the text it was typed as", () => {
    const content = markdown(
      'Dear <Your Name>, <img src="x" onerror="alert(1)">',
    );

    expect(content.html).toBe(
      '<p>Dear &#x3C;Your Name>, &#x3C;img src="x" onerror="alert(1)"></p>',
    );
    expect(content.text).toBe(
      'Dear <Your Name>, <img src="x" onerror="alert(1)">',
    );
  });

  it("keeps an image's alt text when its source is unsafe", () => {
    expect(markdown("![map](javascript:alert(1))").text).toBe("map");
  });

  it("drops unsafe link targets", () => {
    const content = markdown("[click](javascript:alert(1))");

    expect(content.html).toBe("<p><a>click</a></p>");
    expect(content.text).toBe("click");
  });

  it("drops link targets that lead nowhere off the site", () => {
    const content = markdown("[top](#top) and [next](page)");

    expect(content.html).toBe("<p><a>top</a> and <a>next</a></p>");
    expect(content.text).toBe("top and next");
  });

  it("puts links to the legacy domain on the new one", () => {
    const content = markdown(
      "<https://worldalliance.org/actions/5> and [plan](https://worldalliance.org/plan)",
    );

    expect(content.html).toBe(
      '<p><a href="https://thealliance.org/actions/5">https://thealliance.org/actions/5</a> and <a href="https://thealliance.org/plan">plan</a></p>',
    );
    expect(content.text).toBe(
      "https://thealliance.org/actions/5 and plan (https://thealliance.org/plan)",
    );
  });

  it("makes site paths and upload keys absolute", () => {
    const content = markdown("[petition](/actions/5)\n\n![map](abc.png)");

    expect(content.html).toContain(
      '<a href="https://thealliance.org/actions/5">',
    );
    expect(content.html).toContain(
      'src="https://thealliance.org/api/images/abc.png"',
    );
    expect(content.text).toBe(
      "petition (https://thealliance.org/actions/5)\n\nmap (https://thealliance.org/api/images/abc.png)",
    );
  });
});
