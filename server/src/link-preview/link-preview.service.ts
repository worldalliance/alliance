import { R, type Result } from "@alliance/common/result";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  Optional,
} from "@nestjs/common";
import * as cheerio from "cheerio";
import sniffHtmlEncoding from "html-encoding-sniffer";
import iconv from "iconv-lite";
import sharp from "sharp";
import { AsyncSemaphore } from "src/utils/async-semaphore";
import {
  decodedBodyStream,
  defaultSafeHttpTransport,
  fetchWithRedirects,
  getHeader,
  HTML_ACCEPT,
  parseHttpUrl,
  readBodyCapped,
  type SafeHttpTransport,
  type UnfetchableUrl,
} from "src/utils/safe-http";
import { LinkPreview } from "./link-preview.dto";

// Hard ceiling on one preview lookup end-to-end (all redirect hops, all
// address attempts, page + favicon bodies). Without it, a crafted domain
// with many black-holed addresses could pin a fetch slot for minutes.
const OVERALL_DEADLINE_MS = 10_000;
const MAX_HTML_BYTES = 512 * 1024;
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
const PREVIEW_CACHE_TTL_MS = 60 * 60 * 1000;
// Failed/empty lookups are retried sooner so a transient outage on the target
// site doesn't pin an empty preview for a full hour.
const EMPTY_PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
// Favicons rarely change and are keyed per origin, not per page.
const FAVICON_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EMPTY_FAVICON_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
// Bounds this cache only. Preview cache entries also hold favicon data URIs
// (shared per origin, but kept alive even after eviction here) and capped
// text fields (MAX_*_CHARS, ~1KB), so favicons dominate: the combined worst
// case is ~(500 + 1000) × ≤43KB base64 ≈ 64MB.
const MAX_FAVICON_CACHE_ENTRIES = 500;
const MAX_CONCURRENT_FETCHES = 8;
const MAX_QUEUED_FETCHES = 32;
// Expired entries are also dropped on read, but only a sweep reclaims the
// memory of entries nobody asks about again (a burst of unique URLs would
// otherwise sit at the ~64MB worst case until the size caps push them out).
const CACHE_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

/** The lookup was never attempted: the fetch queue was full (load shed). */
export enum PreviewUnavailable {
  Overloaded = "overloaded",
}

export type LinkPreviewError = UnfetchableUrl | PreviewUnavailable;

type CacheEntry = {
  preview: LinkPreview;
  expiresAt: number;
};

/**
 * A completed lookup plus how long its result deserves to live in cache —
 * decided where the outcome's nature is known: a non-HTML content type is as
 * durable a fact about the URL as real metadata, while a fetch failure or a
 * metadata-less page is worth re-probing sooner.
 */
type FetchedPreview = {
  preview: LinkPreview;
  ttlMs: number;
};

type FaviconCacheEntry = {
  dataUri: string | null;
  expiresAt: number;
};

/**
 * DI seam for tests to swap the network layer (DNS + HTTP) for a fake so the
 * full pipeline — redirects, SSRF re-checks, caps, caching, load shedding —
 * runs with no real network. Optional and unprovided in production, where
 * the service falls back to {@link defaultSafeHttpTransport}.
 */
export const LINK_PREVIEW_TRANSPORT = Symbol("LINK_PREVIEW_TRANSPORT");

@Injectable()
export class LinkPreviewService implements OnModuleDestroy {
  private readonly logger = new Logger(LinkPreviewService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly faviconCache = new Map<string, FaviconCacheEntry>();
  private readonly inFlight = new Map<
    string,
    Promise<Result<LinkPreview, PreviewUnavailable>>
  >();
  private readonly faviconInFlight = new Map<string, Promise<string | null>>();
  private readonly fetchLimiter = new AsyncSemaphore(
    MAX_CONCURRENT_FETCHES,
    MAX_QUEUED_FETCHES,
  );
  private readonly transport: SafeHttpTransport;
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(
    @Optional()
    @Inject(LINK_PREVIEW_TRANSPORT)
    transport?: SafeHttpTransport,
  ) {
    this.transport = transport ?? defaultSafeHttpTransport;
    // unref so a live timer never holds the process (or a test run) open.
    this.sweepTimer = setInterval(
      () => this.sweepExpired(),
      CACHE_SWEEP_INTERVAL_MS,
    );
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  /**
   * Failure is one of two expected, caller-handled states: the input wasn't
   * a fetchable http(s) URL (names the rejecting rule; the controller maps
   * it to a per-cause 400), or the fetch queue was full and the lookup was
   * never attempted (mapped to a 503 so clients can tell "busy, retry
   * later" from a page that truly has no metadata). Everything past those
   * gates is best-effort: fetch problems yield an empty preview, not a
   * failure.
   */
  async getPreview(
    rawUrl: string,
  ): Promise<Result<LinkPreview, LinkPreviewError>> {
    const parsed = parseHttpUrl(rawUrl);
    if (!parsed.ok) {
      return parsed;
    }
    const url = parsed.value;

    // Fragments never go on the wire (the fetch sends only path + query), so
    // URLs differing only by fragment are the same page — strip it before
    // keying, or each anchor link would burn a fetch, a cache entry, and a
    // slice of the user's rate-limit budget for identical bytes.
    url.hash = "";

    const key = url.href;
    const cached = this.cache.get(key);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return R.success(cached.preview);
      }
      // Drop expired entries eagerly so the FIFO size cap counts only
      // live ones; the interval sweep reclaims the never-read rest.
      this.cache.delete(key);
    }

    const inFlight = this.inFlight.get(key);
    if (inFlight) {
      return await inFlight;
    }

    const promise = this.fetchAndCache(key, url);
    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async fetchAndCache(
    key: string,
    url: URL,
  ): Promise<Result<LinkPreview, PreviewUnavailable>> {
    let fetched: FetchedPreview;
    try {
      const result = await this.fetchLimiter.run(() => this.fetchPreview(url));
      if (!result.ok) {
        // Shed load without caching: the URL was never attempted, so an
        // empty preview would wrongly stick for EMPTY_PREVIEW_CACHE_TTL_MS —
        // and failing (rather than returning an empty preview) tells the
        // caller this is retryable, not a page without metadata.
        this.logger.warn(`Preview fetch queue full, skipping ${key}`);
        return R.failure(PreviewUnavailable.Overloaded);
      }
      fetched = result.value;
    } catch (error) {
      this.logger.debug(`Preview fetch failed for ${key}: ${String(error)}`);
      fetched = {
        preview: emptyPreview(key),
        ttlMs: EMPTY_PREVIEW_CACHE_TTL_MS,
      };
    }

    this.cache.set(key, {
      preview: fetched.preview,
      expiresAt: Date.now() + fetched.ttlMs,
    });
    this.evictIfNeeded();
    return R.success(fetched.preview);
  }

  /** `now` is a parameter only so tests can sweep without faking timers. */
  private sweepExpired(now = Date.now()): void {
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
    for (const [origin, entry] of this.faviconCache) {
      if (entry.expiresAt <= now) {
        this.faviconCache.delete(origin);
      }
    }
  }

  private evictIfNeeded(): void {
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    while (this.faviconCache.size > MAX_FAVICON_CACHE_ENTRIES) {
      const oldest = this.faviconCache.keys().next().value;
      if (oldest === undefined) break;
      this.faviconCache.delete(oldest);
    }
  }

  private async fetchPreview(url: URL): Promise<FetchedPreview> {
    const requested = url.href;
    const deadline = AbortSignal.timeout(OVERALL_DEADLINE_MS);
    const fetched = await fetchWithRedirects(url, this.transport, {
      signal: deadline,
      accept: HTML_ACCEPT,
    });
    if (!fetched.ok) {
      this.logger.debug(
        `Preview fetch got no page for ${requested}: ${fetched.error}`,
      );
      return {
        preview: emptyPreview(requested),
        ttlMs: EMPTY_PREVIEW_CACHE_TTL_MS,
      };
    }

    const { response, finalUrl } = fetched.value;
    const contentType = getHeader(response.headers, "content-type");
    if (
      !contentType?.includes("text/html") &&
      !contentType?.includes("application/xhtml")
    ) {
      response.body.destroy();
      // "Not an HTML page" is a durable verdict, not a transient failure —
      // full TTL, so a linked binary isn't re-probed every few minutes.
      return {
        preview: emptyPreview(requested),
        ttlMs: PREVIEW_CACHE_TTL_MS,
      };
    }

    const bytes = await readBodyCapped(
      decodedBodyStream(
        response.body,
        getHeader(response.headers, "content-encoding"),
      ),
      MAX_HTML_BYTES,
    );
    const html = decodeHtmlBody(bytes, contentType);
    // One parse shared by the metadata and favicon extractors.
    const $ = cheerio.load(html);
    // The favicon shares the page fetch's deadline: if it can't make it in
    // time, the text preview still goes out without it.
    const faviconDataUri = await this.getFavicon($, finalUrl, deadline);
    const preview = { ...parsePreview($, requested), faviconDataUri };
    const isEmpty = preview.title == null && preview.description == null;
    return {
      preview,
      // A real page that just lacks metadata gets the short TTL too: the
      // emptiness may be a holding page or an outage body, worth re-probing.
      ttlMs: isEmpty ? EMPTY_PREVIEW_CACHE_TTL_MS : PREVIEW_CACHE_TTL_MS,
    };
  }

  /**
   * Favicon for the page's origin as a `data:` URI, from cache when possible.
   * Concurrent lookups for the same origin (a post full of links to one
   * site) share a single fetch — joiners ride the first caller's parsed DOM
   * and deadline, mirroring the preview-level in-flight dedup. Best-effort:
   * a failed lookup (blocked address, non-image bytes, oversized icon) is
   * cached as null so the origin isn't re-probed per page — unless the
   * shared deadline expired first, which says the page was slow, not that
   * the origin lacks an icon.
   */
  private async getFavicon(
    $: cheerio.CheerioAPI,
    finalUrl: URL,
    signal: AbortSignal,
  ): Promise<string | null> {
    const origin = finalUrl.origin;
    const cached = this.faviconCache.get(origin);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return cached.dataUri;
      }
      this.faviconCache.delete(origin);
    }

    const inFlight = this.faviconInFlight.get(origin);
    if (inFlight) {
      return await inFlight;
    }

    const promise = this.fetchAndCacheFavicon(origin, $, finalUrl, signal);
    this.faviconInFlight.set(origin, promise);
    try {
      return await promise;
    } finally {
      this.faviconInFlight.delete(origin);
    }
  }

  /** Never rejects — a missing favicon must not fail the joined callers. */
  private async fetchAndCacheFavicon(
    origin: string,
    $: cheerio.CheerioAPI,
    finalUrl: URL,
    signal: AbortSignal,
  ): Promise<string | null> {
    let dataUri: string | null = null;
    // Candidates in declared order — a stale declared icon (404 after an
    // asset-pipeline change) must not end the lookup while /favicon.ico
    // still works.
    for (const faviconUrl of extractFaviconUrls($, finalUrl)) {
      const candidate = await fetchFaviconCandidate(
        faviconUrl,
        this.transport,
        signal,
      );
      if (candidate.ok) {
        dataUri = candidate.value;
        break;
      }
      this.logger.debug(
        `Favicon candidate ${faviconUrl.href} unusable for ${origin}: ${candidate.error}`,
      );
      // The shared deadline ran out before this candidate got a real
      // attempt — the page was slow, not evidence the origin lacks an icon.
      // Caching null here would blank the whole origin's favicon for the
      // TTL.
      if (signal.aborted) {
        return null;
      }
    }

    this.faviconCache.set(origin, {
      dataUri,
      expiresAt:
        Date.now() +
        (dataUri ? FAVICON_CACHE_TTL_MS : EMPTY_FAVICON_CACHE_TTL_MS),
    });
    return dataUri;
  }
}

function emptyPreview(url: string): LinkPreview {
  return {
    url,
    title: null,
    description: null,
    siteName: null,
    faviconDataUri: null,
  };
}

/**
 * Decodes the fetched HTML per the WHATWG encoding-sniffing algorithm: BOM,
 * then the Content-Type header's charset, then a `<meta charset>` prescan of
 * the first 1024 bytes — legacy non-UTF-8 pages usually declare their
 * charset only in the markup, not the header. Defaults to UTF-8 (not the
 * spec's windows-1252: a missing declaration on the modern web almost
 * always means UTF-8). iconv-lite rather than TextDecoder because Bun (the
 * production runtime) covers most but not all WHATWG encoding labels (e.g.
 * no iso-8859-2 as of Bun 1.3.6), and a constructor throw per unsupported
 * label is a worse seam than iconv-lite's queryable `encodingExists`; the
 * rare sniffed encoding iconv-lite lacks falls back to UTF-8.
 */
export function decodeHtmlBody(
  bytes: Buffer,
  contentTypeHeader: string | null,
): string {
  const encoding = sniffHtmlEncoding(bytes, {
    transportLayerEncodingLabel:
      charsetFromContentType(contentTypeHeader) ?? undefined,
    defaultEncoding: "UTF-8",
  });
  if (iconv.encodingExists(encoding)) {
    return iconv.decode(bytes, encoding);
  }
  return bytes.toString("utf-8");
}

export function charsetFromContentType(
  headerValue: string | null,
): string | null {
  if (!headerValue) {
    return null;
  }
  const match = /charset\s*=\s*"?([\w.:-]+)"?/i.exec(headerValue);
  return match ? match[1].toLowerCase() : null;
}

// The hover card clamps these to a few lines anyway; the caps exist so a
// hostile page can't turn its MAX_HTML_BYTES budget into ~512KB cache
// entries and JSON bodies via one giant <meta> tag.
const MAX_TITLE_CHARS = 300;
const MAX_DESCRIPTION_CHARS = 600;
const MAX_SITE_NAME_CHARS = 100;

/**
 * OpenGraph-first metadata off the already-parsed DOM, with the standard
 * fallbacks (Twitter card tags, then plain HTML). Entities are decoded by
 * the HTML parser. Fields are length-capped without an ellipsis — the UI
 * ellipsizes via line-clamp, and the caps are past what it ever shows.
 */
export function parsePreview(
  $: cheerio.CheerioAPI,
  requestedUrl: string,
): Omit<LinkPreview, "faviconDataUri"> {
  return {
    url: requestedUrl,
    title: truncate(
      metaContent($, ["og:title", "twitter:title"]) ??
        blankToNull($("head title").first().text()),
      MAX_TITLE_CHARS,
    ),
    description: truncate(
      metaContent($, ["og:description", "twitter:description", "description"]),
      MAX_DESCRIPTION_CHARS,
    ),
    siteName: truncate(
      metaContent($, ["og:site_name", "application-name"]),
      MAX_SITE_NAME_CHARS,
    ),
  };
}

function truncate(value: string | null, maxChars: number): string | null {
  if (value == null || value.length <= maxChars) {
    return value;
  }
  const cut = value.slice(0, maxChars);
  // Never end on half a surrogate pair — the cut point may land inside an
  // astral character (emoji in titles are common).
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/**
 * Content of the first non-blank `<meta>` among `keys`, tried in order.
 * Each key matches both `property` and `name` — OpenGraph tags belong in
 * `property` and Twitter/plain tags in `name`, but real pages mix them up.
 */
function metaContent($: cheerio.CheerioAPI, keys: string[]): string | null {
  for (const key of keys) {
    const value = blankToNull(
      $(`meta[property="${key}"], meta[name="${key}"]`).attr("content"),
    );
    if (value) return value;
  }
  return null;
}

/** Collapses runs of whitespace (multi-line `<title>`s are common). */
function blankToNull(value: string | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

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
async function fetchFaviconCandidate(
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
