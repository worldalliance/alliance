import { uploadedVideoKey } from "./video-src";

describe("uploadedVideoKey", () => {
  it("reads the key from a bare key or a storage url on any distribution", () => {
    for (const src of [
      "videos/1777426220647",
      "videos/1777426220647/",
      "https://dj92mxbdjuclo.cloudfront.net/videos/1777426220647",
      "https://d1staging.cloudfront.net/videos/1777426220647/",
    ]) {
      expect(uploadedVideoKey(src)).toBe("videos/1777426220647");
    }
  });

  it("ignores a url that only resembles an upload", () => {
    for (const src of [
      "https://elsewhere.test/videos/1777426220647",
      "https://dj92mxbdjuclo.cloudfront.net.evil.test/videos/1777426220647",
      "https://evil.test?.cloudfront.net/videos/1777426220647",
      "https://evil.test#.cloudfront.net/videos/1777426220647",
      "https://dj92mxbdjuclo.cloudfront.net/videos/1777426220647/extra",
      "http://dj92mxbdjuclo.cloudfront.net/videos/1777426220647",
      "https://dj92mxbdjuclo.cloudfront.net/",
      "",
    ]) {
      expect(uploadedVideoKey(src)).toBeUndefined();
    }
  });
});
