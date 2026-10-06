import { TRACKING_PARAM } from "@alliance/common/linkOpening";
import { isAllianceAppHostname } from "@alliance/common/url";
import {
  WAITLIST_PATH,
  WAITLIST_REFERRER_PARAM,
} from "@alliance/common/waitlist";
import * as cheerio from "cheerio";
import MarkdownIt from "markdown-it";

const linkify = new MarkdownIt().linkify.set({
  fuzzyLink: false,
  fuzzyEmail: false,
});

const configuredHostname = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

/** Local and test runs link to `APP_URL`, which isn't an Alliance host. */
const isTrackedHostname = (hostname: string): boolean =>
  isAllianceAppHostname(hostname) ||
  [process.env.APP_URL, process.env.ALT_APP_URL].some(
    (url) => configuredHostname(url) === hostname,
  );

// A share link is passed on, so its openings aren't the recipient's.
const isShareLink = (url: URL): boolean =>
  url.pathname === WAITLIST_PATH &&
  url.searchParams.has(WAITLIST_REFERRER_PARAM);

export function tagUrl(params: { url: string; trackingId: string }): string {
  let parsed: URL;
  try {
    parsed = new URL(params.url);
  } catch {
    return params.url;
  }
  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    !isTrackedHostname(parsed.hostname) ||
    isShareLink(parsed)
  ) {
    return params.url;
  }
  parsed.searchParams.set(TRACKING_PARAM, params.trackingId);
  return parsed.toString();
}

export function tagTextLinks(params: {
  text: string;
  trackingId: string;
}): string {
  const { text, trackingId } = params;
  let tagged = "";
  let end = 0;
  for (const match of linkify.match(text) ?? []) {
    tagged +=
      text.slice(end, match.index) + tagUrl({ url: match.raw, trackingId });
    end = match.lastIndex;
  }
  return tagged + text.slice(end);
}

/** Tags link targets and the bare URLs in text, which mail clients link. */
export function tagHtmlLinks(params: {
  html: string;
  trackingId: string;
}): string {
  const { html, trackingId } = params;
  const $ = cheerio.load(html);
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (href) $(element).attr("href", tagUrl({ url: href, trackingId }));
  });
  $("body")
    .find("*")
    .addBack()
    .contents()
    .each((_, node) => {
      if (node.type === "text" && !$(node).parents("a, script, style").length) {
        node.data = tagTextLinks({ text: node.data, trackingId });
      }
    });
  return $.html();
}
