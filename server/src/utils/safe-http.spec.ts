import { R } from "@alliance/common/result";
import { PassThrough, Readable } from "node:stream";
import { brotliCompressSync, gzipSync } from "node:zlib";
import {
  buildRequestOptions,
  decodedBodyStream,
  isLocalHostname,
  isPrivateAddress,
  normalizeHostname,
  parseHttpUrl,
  resolvePublicAddresses,
  UnfetchableUrl,
} from "./safe-http";

async function collect(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// These predicates are the SSRF boundary for the safe-http fetcher: any
// address that slips through here gets fetched with the server's egress
// credentials/network position. The blocked table deliberately includes the
// classic bypass vectors (cloud metadata, IPv4-mapped IPv6, NAT64, 6to4,
// Teredo) so a future "relaxation" of the guard fails loudly.
describe("isPrivateAddress", () => {
  const blocked = [
    // IPv4
    ["127.0.0.1", "loopback"],
    ["127.8.8.8", "loopback (non-canonical)"],
    ["10.0.0.1", "RFC 1918 private"],
    ["172.16.0.1", "RFC 1918 private"],
    ["192.168.1.1", "RFC 1918 private"],
    ["169.254.169.254", "link-local / cloud metadata"],
    ["100.64.0.1", "CGNAT"],
    ["0.0.0.0", "unspecified"],
    ["255.255.255.255", "broadcast"],
    ["192.0.2.1", "reserved (TEST-NET-1)"],
    ["224.0.0.1", "multicast"],
    // IPv6
    ["::1", "loopback"],
    ["::", "unspecified"],
    ["fe80::1", "link-local"],
    ["fd00::1", "unique-local"],
    ["fec0::1", "deprecated site-local"],
    ["100::1", "RFC 6666 discard"],
    ["ff02::1", "multicast"],
    // Ranges embedding an IPv4 target — the classic SSRF bypasses
    ["::ffff:169.254.169.254", "IPv4-mapped metadata"],
    ["::ffff:a9fe:a9fe", "IPv4-mapped metadata (hex form)"],
    ["::ffff:10.0.0.1", "IPv4-mapped private"],
    ["64:ff9b::a9fe:a9fe", "NAT64 metadata"],
    ["2002:a9fe:a9fe::1", "6to4 metadata"],
    ["2001:0::1", "Teredo"],
    // Fail closed on garbage
    ["not-an-ip", "unparseable"],
    ["999.1.1.1", "unparseable octet"],
    ["", "empty"],
  ] as const;

  for (const [address, label] of blocked) {
    it(`blocks ${address || "(empty)"} — ${label}`, () => {
      expect(isPrivateAddress(address)).toBe(true);
    });
  }

  const allowed = [
    "1.1.1.1",
    "8.8.8.8",
    "93.184.216.34",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
  ] as const;

  for (const address of allowed) {
    it(`allows public ${address}`, () => {
      expect(isPrivateAddress(address)).toBe(false);
    });
  }
});

describe("parseHttpUrl", () => {
  // For the accepting cases only the parsed URL matters.
  const parse = (raw: string, base?: URL) =>
    R.toNullable(parseHttpUrl(raw, base));

  it("accepts absolute http(s) URLs", () => {
    expect(parse("http://example.com/x")?.href).toBe("http://example.com/x");
    expect(parse("https://example.com")?.href).toBe("https://example.com/");
  });

  const rejectedSchemes = [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "ftp://example.com/x",
    "data:text/html,x",
    "gopher://example.com",
  ] as const;

  for (const raw of rejectedSchemes) {
    it(`rejects ${raw.split(":")[0]}: scheme`, () => {
      expect(parseHttpUrl(raw)).toEqual(
        R.failure(UnfetchableUrl.UnsupportedScheme),
      );
    });
  }

  it("rejects relative URLs without a base", () => {
    expect(parseHttpUrl("/next")).toEqual(R.failure(UnfetchableUrl.Malformed));
    expect(parseHttpUrl("foo")).toEqual(R.failure(UnfetchableUrl.Malformed));
  });

  it("resolves redirect locations against the base URL", () => {
    const base = new URL("https://example.com/a/b");
    expect(parse("/next", base)?.href).toBe("https://example.com/next");
    expect(parse("//other.example/x", base)?.href).toBe(
      "https://other.example/x",
    );
  });

  it("rejects non-http schemes even with a base (redirect target)", () => {
    const base = new URL("https://example.com/");
    expect(parseHttpUrl("javascript:alert(1)", base)).toEqual(
      R.failure(UnfetchableUrl.UnsupportedScheme),
    );
    expect(parseHttpUrl("file:///etc/passwd", base)).toEqual(
      R.failure(UnfetchableUrl.UnsupportedScheme),
    );
  });

  // Explicit ports would let callers aim server-side GETs at arbitrary
  // services on public hosts (port scanning / reflection).
  it("rejects non-default ports, including on redirect targets", () => {
    expect(parseHttpUrl("http://example.com:8080/x")).toEqual(
      R.failure(UnfetchableUrl.ExplicitPort),
    );
    expect(parseHttpUrl("https://example.com:6379/x")).toEqual(
      R.failure(UnfetchableUrl.ExplicitPort),
    );
    const base = new URL("https://example.com/");
    expect(parseHttpUrl("https://other.example:8443/x", base)).toEqual(
      R.failure(UnfetchableUrl.ExplicitPort),
    );
  });

  it("accepts explicit default ports", () => {
    // The URL parser drops a default port, so these normalize to portless.
    expect(parse("http://example.com:80/x")?.href).toBe("http://example.com/x");
    expect(parse("https://example.com:443/x")?.href).toBe(
      "https://example.com/x",
    );
    // Cross-scheme default ports stay explicit but are still fetchable.
    expect(parse("http://example.com:443/x")?.port).toBe("443");
    expect(parse("https://example.com:80/x")?.port).toBe("80");
  });
});

describe("normalizeHostname", () => {
  it("strips IPv6 brackets", () => {
    expect(normalizeHostname("[::1]")).toBe("::1");
  });

  it("strips the trailing dot and lowercases", () => {
    expect(normalizeHostname("Example.COM.")).toBe("example.com");
    expect(normalizeHostname("LOCALHOST")).toBe("localhost");
  });
});

describe("isLocalHostname", () => {
  it("blocks localhost and *.localhost", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("foo.localhost")).toBe(true);
  });

  it("does not block lookalikes", () => {
    expect(isLocalHostname("notlocalhost")).toBe(false);
    expect(isLocalHostname("localhost.example.com")).toBe(false);
  });
});

describe("resolvePublicAddresses", () => {
  it("returns safe literal IP addresses without DNS lookup", async () => {
    await expect(
      resolvePublicAddresses(new URL("https://1.1.1.1/x")),
    ).resolves.toEqual([{ address: "1.1.1.1", family: 4 }]);
  });

  it("blocks unsafe literal IP addresses", async () => {
    await expect(
      resolvePublicAddresses(new URL("http://169.254.169.254/latest")),
    ).rejects.toThrow("Blocked non-public address");
  });

  it("blocks localhost names before DNS lookup", async () => {
    await expect(
      resolvePublicAddresses(new URL("http://foo.localhost/x")),
    ).rejects.toThrow("Blocked localhost");
  });
});

describe("buildRequestOptions", () => {
  it("connects to the resolved address while preserving Host and SNI", () => {
    const url = new URL("https://www.newsweek.com/path?q=1");
    const options = buildRequestOptions(url, {
      address: "146.75.107.52",
      family: 4,
    });

    expect(options.hostname).toBe("146.75.107.52");
    expect(options.servername).toBe("www.newsweek.com");
    expect(options.headers).toMatchObject({ host: "www.newsweek.com" });
    expect(options.path).toBe("/path?q=1");
    expect(options.port).toBe(443);
  });

  it("does not send IP literals as TLS SNI names", () => {
    const url = new URL("https://1.1.1.1/path");
    const options = buildRequestOptions(url, {
      address: "1.1.1.1",
      family: 4,
    });

    expect(options.servername).toBeUndefined();
    expect(options.headers).toMatchObject({ host: "1.1.1.1" });
  });
});

// Some servers/CDNs gzip responses regardless of Accept-Encoding; the body
// must be decompressed before parsing (or dropped for encodings we can't
// decode) so a caller's parser never chews on binary garbage.
describe("decodedBodyStream", () => {
  it("passes identity and missing encodings through untouched", async () => {
    const body = Readable.from([Buffer.from("<html>plain</html>")]);
    expect(decodedBodyStream(body, null)).toBe(body);
    expect(decodedBodyStream(body, "identity")).toBe(body);
    expect(decodedBodyStream(body, "")).toBe(body);
  });

  it("gunzips gzip bodies", async () => {
    const html = "<html><title>zipped — héllo</title></html>";
    const body = Readable.from([gzipSync(Buffer.from(html))]);
    const decoded = decodedBodyStream(body, "gzip");
    expect((await collect(decoded)).toString("utf-8")).toBe(html);
  });

  it("decompresses brotli bodies", async () => {
    const html = "<html><title>brotli — héllo</title></html>";
    const body = Readable.from([brotliCompressSync(Buffer.from(html))]);
    const decoded = decodedBodyStream(body, "br");
    expect((await collect(decoded)).toString("utf-8")).toBe(html);
  });

  it("throws on unsupported encodings and tears down the response", () => {
    const body = new PassThrough();
    expect(() => decodedBodyStream(body, "zstd")).toThrow(
      "Unsupported content-encoding: zstd",
    );
    expect(body.destroyed).toBe(true);
  });

  // readBodyCapped destroys the decoded stream at the byte cap; the
  // underlying response must stop downloading too, not stream on unread.
  it("destroying the decoded stream destroys the source", async () => {
    const body = new PassThrough();
    const decoded = decodedBodyStream(body, "gzip");
    decoded.once("error", () => {});
    decoded.destroy();
    await new Promise((resolve) => setImmediate(resolve));
    expect(body.destroyed).toBe(true);
  });

  it("surfaces corrupt gzip data as a stream error", async () => {
    const body = Readable.from([Buffer.from("not gzip at all")]);
    const decoded = decodedBodyStream(body, "gzip");
    await expect(collect(decoded)).rejects.toThrow();
  });
});
