import * as cheerio from "cheerio";
import {
  extractFaviconUrls,
  isSvgDocument,
  sniffImageMime,
} from "./link-preview-favicon";
import { PNG_BYTES } from "./link-preview.fixtures";

describe("extractFaviconUrls", () => {
  const base = new URL("https://example.com/blog/post");
  // The real pipeline parses once and shares the DOM; here each case
  // parses its own snippet.
  const extract = (html: string, baseUrl: URL) =>
    extractFaviconUrls(cheerio.load(html), baseUrl).map((url) => url.href);

  it('resolves a relative rel="icon" href against the final page URL', () => {
    const html =
      '<html><head><link rel="icon" href="/static/fav.png"></head></html>';
    expect(extract(html, base)).toEqual([
      "https://example.com/static/fav.png",
      "https://example.com/favicon.ico",
    ]);
  });

  it('accepts absolute and legacy rel="shortcut icon" hrefs', () => {
    const html =
      '<link rel="shortcut icon" href="https://cdn.example.net/fav.ico">';
    expect(extract(html, base)).toEqual([
      "https://cdn.example.net/fav.ico",
      "https://example.com/favicon.ico",
    ]);
  });

  it('orders rel="icon" before apple-touch-icon', () => {
    const html = `
      <link rel="apple-touch-icon" href="/touch.png">
      <link rel="icon" href="/fav.ico">`;
    expect(extract(html, base)).toEqual([
      "https://example.com/fav.ico",
      "https://example.com/touch.png",
      "https://example.com/favicon.ico",
    ]);
  });

  it("falls back to apple-touch-icon, then /favicon.ico", () => {
    expect(
      extract('<link rel="apple-touch-icon" href="/t.png">', base),
    ).toEqual(["https://example.com/t.png", "https://example.com/favicon.ico"]);
    expect(extract("<html></html>", base)).toEqual([
      "https://example.com/favicon.ico",
    ]);
  });

  // SVG icons are usable candidates — the fetch path rasterizes them to
  // PNG — so they keep their declared position in the candidate order.
  it("keeps declared SVG icons as candidates", () => {
    const html = `
      <link rel="icon" type="image/svg+xml" href="/fav.svg">
      <link rel="alternate icon" href="/fav.png">`;
    expect(extract(html, base)).toEqual([
      "https://example.com/fav.svg",
      "https://example.com/fav.png",
      "https://example.com/favicon.ico",
    ]);
  });

  // Declared icons go through parseHttpUrl like any fetched URL, so the
  // scheme/port rules apply; unusable candidates fall through to the default.
  it("skips candidates the fetcher would refuse", () => {
    const dataUri = '<link rel="icon" href="data:image/png;base64,iVBORw0=">';
    expect(extract(dataUri, base)).toEqual(["https://example.com/favicon.ico"]);
    const oddPort = '<link rel="icon" href="https://example.com:8443/f.ico">';
    expect(extract(oddPort, base)).toEqual(["https://example.com/favicon.ico"]);
  });

  // Every candidate can cost a fetch within the page's shared deadline, so
  // the declared list is capped and duplicates collapse.
  it("caps declared candidates and dedupes repeated hrefs", () => {
    const manyIcons = `
      <link rel="icon" href="/a.png">
      <link rel="icon" href="/b.png">
      <link rel="icon" href="/c.png">`;
    expect(extract(manyIcons, base)).toEqual([
      "https://example.com/a.png",
      "https://example.com/b.png",
      "https://example.com/favicon.ico",
    ]);

    const duplicated = `
      <link rel="icon" href="/favicon.ico">
      <link rel="shortcut icon" href="/favicon.ico">`;
    expect(extract(duplicated, base)).toEqual([
      "https://example.com/favicon.ico",
    ]);
  });
});

// The favicon bytes are attacker-controlled and end up in a data: URI handed
// to browsers, so only allow-listed raster magic bytes may pass — never the
// declared Content-Type, and never SVG (it can carry scripts).
describe("sniffImageMime", () => {
  const cases: ReadonlyArray<[string, Buffer, string]> = [
    ["ICO", Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]), "image/x-icon"],
    [
      "PNG",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "image/png",
    ],
    ["GIF", Buffer.from("GIF89a"), "image/gif"],
    ["JPEG", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    [
      "WebP",
      Buffer.concat([
        Buffer.from("RIFF"),
        Buffer.alloc(4),
        Buffer.from("WEBP"),
      ]),
      "image/webp",
    ],
  ];

  for (const [label, bytes, mime] of cases) {
    it(`detects ${label}`, () => {
      expect(sniffImageMime(bytes)).toBe(mime);
    });
  }

  const rejected: ReadonlyArray<[string, Buffer]> = [
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ["HTML error page", Buffer.from("<!doctype html><html>404</html>")],
    ["CUR (ICO sibling)", Buffer.from([0x00, 0x00, 0x02, 0x00])],
    ["empty", Buffer.alloc(0)],
    ["truncated magic", Buffer.from([0x89, 0x50])],
  ];

  for (const [label, bytes] of rejected) {
    it(`rejects ${label}`, () => {
      expect(sniffImageMime(bytes)).toBe(null);
    });
  }
});

// Gate to the rasterization path: only documents whose root element is <svg
// reach sharp. Doctypes with an internal subset are refused outright — the
// subset is where entity definitions (billion laughs) live.
describe("isSvgDocument", () => {
  const accepted: ReadonlyArray<[string, string]> = [
    ["bare svg", '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
    ["self-closing svg", "<svg/>"],
    [
      "full prolog (BOM, XML declaration, comment, doctype)",
      '\uFEFF <?xml version="1.0"?> <!-- logo --> ' +
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" ' +
        '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"> <svg></svg>',
    ],
  ];

  for (const [label, text] of accepted) {
    it(`accepts ${label}`, () => {
      expect(isSvgDocument(Buffer.from(text))).toBe(true);
    });
  }

  const rejected: ReadonlyArray<[string, string]> = [
    ["HTML", "<!doctype html><html><svg></svg></html>"],
    [
      "doctype with entity subset (billion laughs)",
      '<!DOCTYPE svg [ <!ENTITY a "aaaa"> ]><svg>&a;</svg>',
    ],
    ["plain text", "not markup"],
    ["empty", ""],
  ];

  for (const [label, text] of rejected) {
    it(`rejects ${label}`, () => {
      expect(isSvgDocument(Buffer.from(text))).toBe(false);
    });
  }

  it("rejects raster bytes", () => {
    expect(isSvgDocument(PNG_BYTES)).toBe(false);
  });
});
