import { charsetFromContentType, decodeHtmlBody } from "./link-preview-html";

describe("charsetFromContentType", () => {
  it("extracts the charset parameter, ignoring case and quotes", () => {
    expect(charsetFromContentType("text/html; charset=UTF-8")).toBe("utf-8");
    expect(charsetFromContentType('text/html; charset="windows-1251"')).toBe(
      "windows-1251",
    );
    expect(charsetFromContentType("text/html;charset=Shift_JIS")).toBe(
      "shift_jis",
    );
  });

  it("returns null when no charset is declared", () => {
    expect(charsetFromContentType("text/html")).toBe(null);
    expect(charsetFromContentType(null)).toBe(null);
  });
});

describe("decodeHtmlBody", () => {
  // "Привет" in windows-1251
  const win1251 = Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);

  it("decodes using the header-declared charset", () => {
    expect(decodeHtmlBody(win1251, "text/html; charset=windows-1251")).toBe(
      "Привет",
    );
  });

  // Legacy non-UTF-8 pages usually declare their charset only in the markup;
  // the WHATWG prescan of the first 1024 bytes must pick it up.
  it("sniffs <meta charset> when the header declares none", () => {
    const html = Buffer.concat([
      Buffer.from('<html><head><meta charset="windows-1251"><title>'),
      win1251,
      Buffer.from("</title></head></html>"),
    ]);
    expect(decodeHtmlBody(html, "text/html")).toContain("Привет");
    expect(decodeHtmlBody(html, null)).toContain("Привет");
  });

  it("prefers the header charset over <meta charset>", () => {
    // The meta lies (claims UTF-8); the transport-layer label wins per spec.
    const html = Buffer.concat([
      Buffer.from('<meta charset="utf-8">'),
      win1251,
    ]);
    expect(decodeHtmlBody(html, "text/html; charset=windows-1251")).toContain(
      "Привет",
    );
  });

  it("prefers a BOM over everything else", () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const html = Buffer.concat([bom, Buffer.from("héllo", "utf-8")]);
    expect(decodeHtmlBody(html, "text/html; charset=windows-1251")).toBe(
      "héllo",
    );
  });

  it("falls back to UTF-8 for missing or unknown charsets", () => {
    const utf8 = Buffer.from("héllo", "utf-8");
    expect(decodeHtmlBody(utf8, "text/html")).toBe("héllo");
    expect(decodeHtmlBody(utf8, "text/html; charset=not-a-charset")).toBe(
      "héllo",
    );
    expect(decodeHtmlBody(utf8, null)).toBe("héllo");
  });
});
