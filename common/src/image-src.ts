import { safeUrl } from "./url-safety";

/** Stored sources may be upload keys or absolute URLs; upload keys contain no slash or scheme. */
export function isUploadKey(src: string): boolean {
  return !src.includes("/") && !src.includes(":");
}

export function uploadSrc({
  key,
  apiUrl,
}: {
  key: string;
  apiUrl: string;
}): string {
  return `${apiUrl}/images/${key}`;
}

/** Leaves anything already addressable — absolute URL, data uri, path — alone. */
export function resolveUploadSrc({
  src,
  apiUrl,
}: {
  src: string;
  apiUrl: string;
}): string {
  return isUploadKey(src) ? uploadSrc({ key: src, apiUrl }) : src;
}

/**
 * {@link resolveUploadSrc} for a source that came from authored content. The
 * rejection has to happen first, or a `javascript:` source would come back out
 * as an `images/` request.
 */
export function resolveSafeUploadSrc({
  src,
  apiUrl,
}: {
  src: string;
  apiUrl: string;
}): string {
  const safe = safeUrl(src);
  return safe ? resolveUploadSrc({ src: safe, apiUrl }) : safe;
}
