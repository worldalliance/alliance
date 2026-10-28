import {
  changedPhoto,
  echoesStoredKey,
  ImageSaveKind,
  imageSaveTarget,
  isThumbnailKey,
  isUploadKey,
  jpegFileName,
  resolveSafeUploadSrc,
  resolveUploadSrc,
  thumbnailKey,
  thumbnailSrc,
  uploadKeyInUrl,
  uploadSrc,
} from "./image-src";
import { R } from "./result";

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
      echoesStoredKey({
        next: `https://example.com/images/${key}`,
        stored: null,
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

describe("thumbnailKey", () => {
  it("suffixes the width onto both key shapes", () => {
    expect(thumbnailKey("1770253183572.webp")).toBe("1770253183572-128.webp");
    expect(
      thumbnailKey("1770253183572-4d1e3c2b-1a2b-3c4d-5e6f-7a8b9c0d1e2f.webp"),
    ).toBe("1770253183572-4d1e3c2b-1a2b-3c4d-5e6f-7a8b9c0d1e2f-128.webp");
  });

  it("round-trips through isThumbnailKey", () => {
    expect(isThumbnailKey(thumbnailKey("1770253183572.webp"))).toBe(true);
    expect(isThumbnailKey("1770253183572.webp")).toBe(false);
  });
});

describe("thumbnailSrc", () => {
  it("rewrites each url shape the api renders", () => {
    const key = "1770253183572-4d1e3c2b-1a2b-3c4d-5e6f-7a8b9c0d1e2f.webp";
    const thumb = thumbnailKey(key);
    expect(thumbnailSrc(`https://dj92mxbdjuclo.cloudfront.net/${key}`)).toBe(
      `https://dj92mxbdjuclo.cloudfront.net/${thumb}`,
    );
    expect(thumbnailSrc(`https://worldalliance.org/api/images/${key}`)).toBe(
      `https://worldalliance.org/api/images/${thumb}`,
    );
    expect(thumbnailSrc(`http://localhost:3000/images/${key}`)).toBe(
      `http://localhost:3000/images/${thumb}`,
    );
  });

  it("leaves anything that is not a rendered upload alone", () => {
    expect(thumbnailSrc("/noun-user-icon.svg")).toBe("/noun-user-icon.svg");
    expect(thumbnailSrc("https://example.com/promo.png")).toBe(
      "https://example.com/promo.png",
    );
    expect(thumbnailSrc("data:image/webp;base64,AAAA")).toBe(
      "data:image/webp;base64,AAAA",
    );
  });

  it("does not re-suffix a thumbnail url", () => {
    const thumb = "https://dj92mxbdjuclo.cloudfront.net/1770253183572-128.webp";
    expect(thumbnailSrc(thumbnailSrc(thumb))).toBe(thumb);
  });
});

describe("jpegFileName", () => {
  it.each([
    [undefined, "image.jpg"],
    ["", "image.jpg"],
    ["  ", "image.jpg"],
    ["Rally poster", "Rally poster.jpg"],
    ["Rally poster.jpeg", "Rally poster.jpg"],
    ["IMG_0001.HEIC", "IMG_0001.jpg"],
    ['a/b:c*?"<>|d', "abcd.jpg"],
    ["x".repeat(200), `${"x".repeat(80)}.jpg`],
    ["x".repeat(79) + "😀z", `${"x".repeat(79)}😀.jpg`],
    ["Rally poster.jpg ", "Rally poster.jpg"],
    ["a\ud800b", "ab.jpg"],
    ["a\u0000b\nc\td", "abcd.jpg"],
    ["invoice\u202Efdp", "invoicefdp.jpg"],
    ["invoice\u2067fdp\u2069", "invoicefdp.jpg"],
    [".hidden", "hidden.jpg"],
    ["a.", "a.jpg"],
    ["photo.jpg.", "photo.jpg"],
  ])("names %p as %p", (name, expected) => {
    expect(jpegFileName(name)).toBe(expected);
  });
});

describe("imageSaveTarget", () => {
  const apiUrl = "http://localhost:3005";
  const key = "1762925939234-8f14e45f-ceea-467f-a0e6-4a1b2c3d4e5f.webp";

  it.each([
    ["the url it renders as", `http://localhost:3005/images/${key}`],
    ["a rendered cloudfront url", `https://cdn.example.com/${key}`],
  ])("points %s at the jpeg download", (_, src) => {
    expect(imageSaveTarget({ src, apiUrl })).toEqual(
      R.success({
        kind: ImageSaveKind.Download,
        key,
        url: `http://localhost:3005/images/${key}/download?name=image.jpg`,
        fileName: "image.jpg",
      }),
    );
  });

  it("carries the author's name to the download", () => {
    expect(
      imageSaveTarget({
        src: `https://cdn.example.com/${key}`,
        apiUrl,
        name: "Rally poster",
      }),
    ).toMatchObject({
      value: {
        url: `http://localhost:3005/images/${key}/download?name=Rally%20poster.jpg`,
        fileName: "Rally poster.jpg",
      },
    });
  });

  it.each([
    ["an external url", "https://example.com/photo.png"],
    ["an unresolved key", key],
  ])("opens %s as it is", (_, src) => {
    expect(imageSaveTarget({ src, apiUrl })).toEqual(
      R.success({ kind: ImageSaveKind.Open, url: src }),
    );
  });

  it("refuses a source with an unsafe scheme", () => {
    expect(
      imageSaveTarget({ src: "javascript:alert(1)", apiUrl }),
    ).toMatchObject({ ok: false });
  });
});
