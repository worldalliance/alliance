import { resolveSafeUploadSrc } from "@alliance/common/image-src";
import { safeMarkdownUrl } from "@alliance/common/markdown-url";
import { useCallback } from "react";
import { type UrlTransform } from "react-markdown";
import { useSiteHref } from "../ui/SiteAppProvider";
import { getApiUrl } from "./config";

export function resolveMarkdownImageSrc(url: string): string {
  return resolveSafeUploadSrc({ src: url, apiUrl: getApiUrl() });
}

/**
 * Passing a `urlTransform` replaces react-markdown's protocol allowlist rather
 * than adding to it, so every URL goes through `safeMarkdownUrl` here or
 * `javascript:` hrefs in authored markdown reach the DOM. `safeUrl` stands in
 * for the built-in `defaultUrlTransform` because mobile renders the same
 * authored markdown and has no react-markdown to borrow it from.
 */
export const transformMarkdownUrl: UrlTransform = (url, key, node) =>
  safeMarkdownUrl({
    url,
    attribute: key,
    tagName: node.tagName,
    apiUrl: getApiUrl(),
  });

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
