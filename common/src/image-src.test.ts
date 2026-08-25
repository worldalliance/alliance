import { isUploadKey } from "./image-src";

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
