import { resolveSafeUploadSrc } from "@alliance/common/image-src";
import { safeUrl } from "@alliance/common/url-safety";
import { useCallback } from "react";
import { type UrlTransform } from "react-markdown";
import { useSiteHref } from "../ui/SiteAppProvider";
import { getApiUrl } from "./config";

/**
 * Passing a `urlTransform` replaces react-markdown's protocol allowlist rather
 * than adding to it, so every URL goes through `safeUrl` here or `javascript:`
 * hrefs in authored markdown reach the DOM. `safeUrl` stands in for the
 * built-in `defaultUrlTransform` because mobile renders the same authored
 * markdown and has no react-markdown to borrow it from.
 */
export function resolveMarkdownImageSrc(url: string): string {
  return resolveSafeUploadSrc({ src: url, apiUrl: getApiUrl() });
}

/**
 * Only image sources may be bare upload keys. Link hrefs are left alone: a
 * slash-free href is an in-page anchor far more often than an upload key.
 */
export const transformMarkdownUrl: UrlTransform = (url, key, node) =>
  key === "src" && node.tagName === "img"
    ? resolveMarkdownImageSrc(url)
    : safeUrl(url);

/**
 * {@link transformMarkdownUrl} against the site's own hosts, so a link keeps
 * the reader on the domain they arrived on and an image is fetched from it.
 * One vhost serves both domains and proxies /api on each, so the path a URL on
 * either one reduces to resolves the same from the other.
 */
export function useMarkdownUrlTransform(): UrlTransform {
  const siteHref = useSiteHref();
  return useCallback<UrlTransform>(
    (url, key, node) => siteHref(transformMarkdownUrl(url, key, node) ?? ""),
    [siteHref],
  );
}
