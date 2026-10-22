import { resolveSafeUploadSrc } from "./image-src";
import { safeUrl } from "./url-safety";

/**
 * A URL from authored markdown, made safe to embed. Only image sources may be
 * bare upload keys. Link hrefs are left alone: a slash-free href is an in-page
 * anchor far more often than an upload key.
 */
export function safeMarkdownUrl({
  url,
  attribute,
  tagName,
  apiUrl,
}: {
  url: string;
  attribute: string;
  tagName: string;
  apiUrl: string;
}): string {
  return attribute === "src" && tagName === "img"
    ? resolveSafeUploadSrc({ src: url, apiUrl })
    : safeUrl(url);
}
