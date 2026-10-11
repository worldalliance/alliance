import { R, type Result } from "@alliance/common/result";
import * as cheerio from "cheerio";
import sharp from "sharp";
import {
  decodedBodyStream,
  fetchWithRedirects,
  getHeader,
  parseHttpUrl,
  readBodyCapped,
  type SafeHttpTransport,
} from "src/utils/safe-http";

const FAVICON_ACCEPT = "image/webp,image/png,image/svg+xml,image/*";
// Favicons over this size are dropped (not truncated — a cut-off image is
// garbage), keeping the JSON response and the per-origin cache small.
const MAX_FAVICON_BYTES = 32 * 1024;
// SVG favicons are rasterized to PNG at this size — displayed at 16px, so
// 64px covers high-DPI screens, and the output stays a few KB.
const FAVICON_RASTER_SIZE = 64;
// A pathological SVG must not pin a fetch slot: libvips gets its own hard
// stop well inside the lookup's overall deadline.
const SVG_RASTERIZE_TIMEOUT_SECONDS = 2;

// Fetch attempts per favicon lookup: up to two declared candidates, then
// the conventional /favicon.ico. Each attempt spends a slice of the page's
// shared deadline, so the list stays short.
const MAX_DECLARED_FAVICON_CANDIDATES = 2;

/**
 * Favicon URLs declared in the page's markup, resolved against the final
 * page URL and deduped, with the conventional `/favicon.ico` appended as
 * the last resort. Candidates that fail {@link parseHttpUrl} (`data:` URIs,
 * explicit ports, ...) are skipped rather than failing the lookup.
 */
export function extractFaviconUrls($: cheerio.CheerioAPI, baseUrl: URL): URL[] {
  const candidates = [
    // [rel~="icon"] is a word match: it covers rel="icon" and the legacy
    // rel="shortcut icon", but not rel="apple-touch-icon".
    ...$('link[rel~="icon"]')
      .toArray()
      .map((el) => $(el)),
    ...$('link[rel="apple-touch-icon"]')
      .toArray()
      .map((el) => $(el)),
  ];

  const urls = new Map<string, URL>();
  for (const link of candidates) {
    if (urls.size >= MAX_DECLARED_FAVICON_CANDIDATES) break;
    const href = link.attr("href");
    if (!href) continue;
    // toNullable: which parse rule disqualified a candidate doesn't matter,
    // only that the next one gets a turn.
    const url = R.toNullable(parseHttpUrl(href, baseUrl));
    if (url) urls.set(url.href, url);
  }

  const fallback = R.toNullable(parseHttpUrl("/favicon.ico", baseUrl));
  if (fallback) urls.set(fallback.href, fallback);
  return [...urls.values()];
}

/**
 * One candidate: fetched through the same SSRF-guarded pipeline as the page
 * itself, capped, magic-byte sniffed, and returned as a `data:` URI —
 * inlining the bytes keeps the reader's browser from ever contacting the
 * linked host, the same reason the preview is text-otherwise. SVG bodies
 * (no magic bytes to sniff) are rasterized to PNG rather than inlined, so
 * the client is only ever handed raster bytes. Failure says why the
 * candidate is unusable (unreachable, oversized, not an allow-listed
 * raster format) for the caller's debug log; with several candidates per
 * lookup, a bare null would leave no trace of which died and why. Never
 * rejects: thrown fetch errors (DNS, SSRF block, transport or stream
 * teardown) are folded into the same disqualification channel.
 */
export async function fetchFaviconCandidate(
  faviconUrl: URL,
  transport: SafeHttpTransport,
  signal: AbortSignal,
): Promise<Result<string, string>> {
  try {
    const fetched = await fetchWithRedirects(faviconUrl, transport, {
      signal,
      accept: FAVICON_ACCEPT,
    });
    if (!fetched.ok) {
      return fetched;
    }

    // Read one byte past the cap so truncation is detectable: an over-limit
    // icon is dropped whole, never served cut off.
    const bytes = await readBodyCapped(
      decodedBodyStream(
        fetched.value.response.body,
        getHeader(fetched.value.response.headers, "content-encoding"),
      ),
      MAX_FAVICON_BYTES + 1,
    );
    if (bytes.byteLength > MAX_FAVICON_BYTES) {
      return R.failure(`icon exceeds ${MAX_FAVICON_BYTES} bytes`);
    }

    const mime = sniffImageMime(bytes);
    if (mime) {
      return R.success(`data:${mime};base64,${bytes.toString("base64")}`);
    }
    if (isSvgDocument(bytes)) {
      return await rasterizeSvgFavicon(bytes);
    }
    return R.failure(
      "bytes are neither an allow-listed raster format nor a rasterizable SVG",
    );
  } catch (error) {
    return R.failure(String(error));
  }
}

/**
 * Content-type of the image by magic bytes, or null for anything not on the
 * raster allow-list. The bytes are attacker-controlled and get embedded in a
 * `data:` URI we hand to browsers, so the declared Content-Type header is
 * ignored entirely and SVG is deliberately excluded — it has no magic bytes
 * and can carry scripts. SVG candidates are instead rasterized to PNG (see
 * {@link rasterizeSvgFavicon}), which never inlines the markup itself.
 */
export function sniffImageMime(bytes: Buffer): string | null {
  if (bytes.length >= 4 && bytes.readUInt32BE(0) === 0x00000100) {
    return "image/x-icon";
  }
  if (bytes.length >= 8 && bytes.subarray(0, 4).equals(PNG_MAGIC)) {
    return "image/png";
  }
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("latin1") === "GIF8") {
    return "image/gif";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/**
 * Whether the bytes are an SVG document: an `<svg` root element after an
 * optional prolog (BOM, XML declaration, comments, doctype). Doctypes with
 * an internal subset (`[...]`) are refused outright — that's where entity
 * definitions (billion-laughs expansion) live, and rejecting them beats
 * reasoning about the XML parser's expansion limits.
 */
export function isSvgDocument(bytes: Buffer): boolean {
  // Only the prolog and root tag need inspecting.
  let text = bytes.subarray(0, 1024).toString("utf-8");
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  for (;;) {
    text = text.trimStart();
    if (text.startsWith("<?")) {
      const end = text.indexOf("?>");
      if (end === -1) return false;
      text = text.slice(end + 2);
    } else if (text.startsWith("<!--")) {
      const end = text.indexOf("-->");
      if (end === -1) return false;
      text = text.slice(end + 3);
    } else if (/^<!doctype/i.test(text)) {
      const end = text.indexOf(">");
      if (end === -1) return false;
      if (text.slice(0, end).includes("[")) return false;
      text = text.slice(end + 1);
    } else {
      return /^<svg[\s>/]/.test(text);
    }
  }
}

/**
 * SVG made safe by rasterizing: the PNG that comes out is inert pixels, so
 * scripts, event handlers, and foreign content in the source can't survive
 * into the `data:` URI. librsvg (sharp's SVG loader) never fetches remote
 * references, and a buffer input has no base path for local file ones, so
 * rasterization can't be used to reach past the SSRF guard either. The
 * density renders the icon's intrinsic size a step larger than the target
 * so downscaling stays crisp.
 *
 * The byte cap bounds the SVG source, not the raster it declares: a tiny
 * file claiming huge intrinsic dimensions would allocate the full-size
 * pixel buffer before the resize (sharp's default limitInputPixels is
 * ~268MP ≈ 1GB of RGBA), so cap the load-time raster too — generous for
 * any real icon at this density.
 */
const SVG_RASTER_INPUT_PIXEL_LIMIT = 4_000_000;

async function rasterizeSvgFavicon(
  bytes: Buffer,
): Promise<Result<string, string>> {
  try {
    const png = await sharp(bytes, {
      density: 300,
      limitInputPixels: SVG_RASTER_INPUT_PIXEL_LIMIT,
    })
      .timeout({ seconds: SVG_RASTERIZE_TIMEOUT_SECONDS })
      .resize(FAVICON_RASTER_SIZE, FAVICON_RASTER_SIZE, { fit: "inside" })
      .png()
      .toBuffer();
    return R.success(`data:image/png;base64,${png.toString("base64")}`);
  } catch (error) {
    return R.failure(`SVG rasterization failed: ${String(error)}`);
  }
}
