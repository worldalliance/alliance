import * as cheerio from "cheerio";
import sniffHtmlEncoding from "html-encoding-sniffer";
import iconv from "iconv-lite";
import { LinkPreview } from "./link-preview.dto";

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
