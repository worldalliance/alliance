import {
  changedPhoto,
  echoesStoredKey,
  isUploadKey,
  resolveSafeUploadSrc,
  resolveUploadSrc,
  uploadKeyInUrl,
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

describe("changedPhoto", () => {
  const url = "https://dj92mxbdjuclo.cloudfront.net/1770253183572.webp";

  it("sends nothing for the url the api just rendered", () => {
    expect(changedPhoto({ current: url, next: url })).toBeUndefined();
    expect(changedPhoto({ current: null, next: null })).toBeUndefined();
  });

  it("sends null for a photo the user cleared", () => {
    expect(changedPhoto({ current: url, next: null })).toBeNull();
  });

  it("sends the new image the user picked", () => {
    const dataUri = "data:image/webp;base64,UklGRg==";
    expect(changedPhoto({ current: url, next: dataUri })).toBe(dataUri);
    expect(changedPhoto({ current: null, next: dataUri })).toBe(dataUri);
  });
});

describe("echoesStoredKey", () => {
  const key = "1770253183572.webp";

  it("catches the url whichever host rendered it", () => {
    expect(
      echoesStoredKey({
        next: `https://dj92mxbdjuclo.cloudfront.net/${key}`,
        stored: key,
      }),
    ).toBe(true);
    expect(
      echoesStoredKey({
        next: `http://localhost:3000/images/${key}`,
        stored: key,
      }),
    ).toBe(true);
  });

  it("leaves a url the client typed alone", () => {
    expect(
      echoesStoredKey({ next: "https://example.com/promo.png", stored: key }),
    ).toBe(false);
    expect(
      echoesStoredKey({
        next: "https://example.com/images/1770253183572-other.webp",
        stored: key,
      }),
    ).toBe(false);
  });

  it("has nothing to echo when the column holds no key", () => {
    expect(
      echoesStoredKey({
        next: `https://example.com/images/${key}`,
        stored: undefined,
      }),
    ).toBe(false);
    expect(
      echoesStoredKey({ next: "https://example.com/a/", stored: "" }),
    ).toBe(false);
    expect(
      echoesStoredKey({
        next: `https://example.com/${key}`,
        stored: "https://example.com/promo.png",
      }),
    ).toBe(false);
  });
});

describe("uploadKeyInUrl", () => {
  it("reads the key back out of every shape getImageSource renders", () => {
    const key = "1770253183572-4d1e3c2b-1a2b-3c4d-5e6f-7a8b9c0d1e2f.webp";
    expect(uploadKeyInUrl(`https://dj92mxbdjuclo.cloudfront.net/${key}`)).toBe(
      key,
    );
    expect(uploadKeyInUrl(`https://worldalliance.org/api/images/${key}`)).toBe(
      key,
    );
    expect(uploadKeyInUrl(`http://localhost:3000/images/${key}`)).toBe(key);
    expect(uploadKeyInUrl("https://worldalliance.org/1770253183572.webp")).toBe(
      "1770253183572.webp",
    );
  });

  it("has no key to read out of a url shaped like anything else", () => {
    expect(uploadKeyInUrl("https://example.com/promo.png")).toBeUndefined();
    expect(
      uploadKeyInUrl("https://example.com/images/promo.webp"),
    ).toBeUndefined();
    expect(
      uploadKeyInUrl("https://example.com/1770253183572.webp?w=64"),
    ).toBeUndefined();
    expect(uploadKeyInUrl("1770253183572.webp")).toBeUndefined();
  });

  it("reads one out of an external url that shares the shape", () => {
    expect(
      uploadKeyInUrl("https://images.unsplash.com/images/1707862.webp"),
    ).toBe("1707862.webp");
  });
});
