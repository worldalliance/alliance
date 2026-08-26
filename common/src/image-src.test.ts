import { isUploadKey, resolveUploadSrc, uploadSrc } from "./image-src";

describe("isUploadKey", () => {
  it("accepts the key shape the image service mints", () => {
    expect(isUploadKey("1770255651460.webp")).toBe(true);
    expect(isUploadKey("1762925939234-8f14e45f.webp")).toBe(true);
  });

  it("rejects an absolute url", () => {
    expect(isUploadKey("https://dj92mxbdjuclo.cloudfront.net/a.webp")).toBe(
      false,
    );
  });

  it("rejects a path", () => {
    expect(isUploadKey("assets/logo.webp")).toBe(false);
    expect(isUploadKey("/images/logo.webp")).toBe(false);
  });

  it("rejects a data uri", () => {
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
