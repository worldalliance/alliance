import {
  isUploadKey,
  resolveSafeUploadSrc,
  resolveUploadSrc,
  uploadSrc,
} from "./image-src";

describe("isUploadKey", () => {
  it("accepts the key shape the image service mints", () => {
    expect(isUploadKey("1762925939234-8f14e45f.webp")).toBe(true);
    expect(isUploadKey("1770255651460.webp")).toBe(true);
  });

  it("rejects absolute urls, whichever host serves them", () => {
    expect(isUploadKey("https://dj92mxbdjuclo.cloudfront.net/1770.webp")).toBe(
      false,
    );
    expect(isUploadKey("https://worldalliance.org/api/images/1765.webp")).toBe(
      false,
    );
    expect(isUploadKey("http://localhost:3000/images/1765.webp")).toBe(false);
  });

  it("rejects paths and data uris, which prefixing would mangle", () => {
    expect(isUploadKey("assets/logo.webp")).toBe(false);
    expect(isUploadKey("data:image/webp;base64,UklGRg==")).toBe(false);
  });
});

describe("uploadSrc", () => {
  it("addresses a key through the api's images route", () => {
    expect(
      uploadSrc({ key: "1770255651460.webp", apiUrl: "http://localhost:3000" }),
    ).toBe("http://localhost:3000/images/1770255651460.webp");
  });
});

describe("resolveUploadSrc", () => {
  const apiUrl = "http://localhost:3000";

  it("prefixes a key with the caller's api url", () => {
    expect(resolveUploadSrc({ src: "1770255651460.webp", apiUrl })).toBe(
      "http://localhost:3000/images/1770255651460.webp",
    );
  });

  it("leaves an already addressable source alone", () => {
    const url = "https://dj92mxbdjuclo.cloudfront.net/1770253183572.webp";

    expect(resolveUploadSrc({ src: url, apiUrl })).toBe(url);
    expect(resolveUploadSrc({ src: "assets/logo.webp", apiUrl })).toBe(
      "assets/logo.webp",
    );
  });
});

describe("resolveSafeUploadSrc", () => {
  const apiUrl = "http://localhost:3000";

  it("resolves the same sources resolveUploadSrc does", () => {
    for (const src of [
      "1770255651460.webp",
      "https://dj92mxbdjuclo.cloudfront.net/1770253183572.webp",
      "assets/logo.webp",
    ]) {
      expect(resolveSafeUploadSrc({ src, apiUrl })).toBe(
        resolveUploadSrc({ src, apiUrl }),
      );
    }
  });

  it("does not turn a rejected source into an images request", () => {
    expect(resolveSafeUploadSrc({ src: "javascript:alert(1)", apiUrl })).toBe(
      "",
    );
    expect(resolveSafeUploadSrc({ src: "alliance://actions/12", apiUrl })).toBe(
      "",
    );
  });
});
