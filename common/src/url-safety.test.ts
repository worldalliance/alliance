import { isSafeLinkUrl, isSafeUrl, safeUrl, urlProtocol } from "./url-safety";

describe("urlProtocol", () => {
  it("reads the scheme off a url that carries one", () => {
    expect(urlProtocol("https://worldalliance.org")).toBe("https");
    expect(urlProtocol("javascript:alert(1)")).toBe("javascript");
  });

  it("reports no protocol for a path, an anchor or a bare key", () => {
    expect(urlProtocol("/actions/12")).toBeNull();
    expect(urlProtocol("#intro")).toBeNull();
    expect(urlProtocol("1770255651460.webp")).toBeNull();
  });

  it("reads a colon inside a path or query as part of the URL, not a protocol", () => {
    expect(urlProtocol("/actions/12?t=10:30")).toBeNull();
    expect(urlProtocol("#a:b")).toBeNull();
  });
});

describe("isSafeUrl", () => {
  it("allows relative paths, anchors and the web protocols", () => {
    expect(isSafeUrl("/actions/12")).toBe(true);
    expect(isSafeUrl("#intro")).toBe(true);
    expect(isSafeUrl("1770255651460.webp")).toBe(true);
    expect(isSafeUrl("https://worldalliance.org")).toBe(true);
    expect(isSafeUrl("mailto:contact@worldalliance.org")).toBe(true);
  });

  it("rejects protocols that hand control to the host app", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("JaVaScRiPt:alert(1)")).toBe(false);
    expect(isSafeUrl("about:reader?url=https%3A%2F%2Fexample.com")).toBe(false);
    expect(isSafeUrl("alliance://actions/12")).toBe(false);
  });

  it("rejects a url that opens with a bare colon", () => {
    expect(isSafeUrl(":alert(1)")).toBe(false);
  });

  it("reads a colon inside a path or query as part of the URL, not a protocol", () => {
    expect(isSafeUrl("/actions/12?t=10:30")).toBe(true);
    expect(isSafeUrl("#a:b")).toBe(true);
  });

  it("keeps `tel:` out of what may be embedded in a document", () => {
    expect(isSafeUrl("tel:+15551234567")).toBe(false);
  });

  // Spelled out here rather than read off the allowlist, so widening the
  // allowlist by accident fails this instead of agreeing with itself.
  it("allows every protocol on the list and nothing else", () => {
    for (const protocol of ["http", "https", "irc", "ircs", "mailto", "xmpp"]) {
      expect(isSafeUrl(`${protocol}:a@b.org`)).toBe(true);
      expect(isSafeUrl(`${protocol.toUpperCase()}:a@b.org`)).toBe(true);
      // Every one of these is safe to open too, or mobile refuses a link the
      // web renders.
      expect(isSafeLinkUrl(`${protocol}:a@b.org`)).toBe(true);
    }

    for (const protocol of ["data", "file", "ftp", "blob", "ws", "vbscript"]) {
      expect(isSafeUrl(`${protocol}:a@b.org`)).toBe(false);
    }
  });
});

describe("isSafeLinkUrl", () => {
  it("adds the schemes that address the device", () => {
    expect(isSafeLinkUrl("tel:+15551234567")).toBe(true);
    expect(isSafeLinkUrl("sms:+15551234567")).toBe(true);
  });

  it("allows everything a document may embed", () => {
    expect(isSafeLinkUrl("https://worldalliance.org")).toBe(true);
    expect(isSafeLinkUrl("mailto:contact@worldalliance.org")).toBe(true);
    expect(isSafeLinkUrl("/actions/12")).toBe(true);
  });

  it("still rejects scripts and unknown app schemes", () => {
    expect(isSafeLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeLinkUrl("alliance://actions/12")).toBe(false);
    expect(isSafeLinkUrl("intent://scan/#Intent;end")).toBe(false);
  });
});

describe("safeUrl", () => {
  it("blanks an unsafe url and passes a safe one through", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("https://worldalliance.org")).toBe(
      "https://worldalliance.org",
    );
  });
});
