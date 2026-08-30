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

/**
 * What an update should send for a photo the user may have edited. The api
 * renders a stored photo as a url, so sending an unchanged one back would
 * replace the upload key with that url. Undefined leaves the photo alone and
 * null clears it.
 */
export function changedPhoto({
  current,
  next,
}: {
  current: string | null;
  next: string | null;
}): string | null | undefined {
  return next === current ? undefined : next;
}
