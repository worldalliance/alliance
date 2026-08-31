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

/**
 * Whether a photo a client sent back is the url the api rendered for the key
 * already stored. Writing it would replace the key with a url that breaks as
 * soon as the host serving uploads changes.
 */
export function echoesStoredKey({
  next,
  stored,
}: {
  next: string;
  stored: string | undefined;
}): boolean {
  return !!stored && isUploadKey(stored) && next.endsWith(`/${stored}`);
}

// The three shapes getImageSource renders a key as: a cloudfront url,
// `{APP_URL}/api/images/{key}`, and `http://localhost:{port}/images/{key}`. A
// key is `{timestamp}.webp`, or `{timestamp}-{uuid}.webp` since newImageKey
// started appending a uuid.
const RENDERED_KEY_URL =
  /^https?:\/\/[^/]+\/(?:api\/images\/|images\/)?([0-9]+(?:-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})?\.webp)$/;

/**
 * The upload key a url ends in, if it has the shape of one the api rendered.
 * An external url whose filename happens to look like a key matches too, so a
 * caller that knows how uploads are rendered confirms the whole url —
 * `renderedImageKey` on the server.
 */
export function uploadKeyInUrl(src: string): string | undefined {
  return RENDERED_KEY_URL.exec(src)?.[1];
}
