import { R, type Result } from "./result";
import { isSafeUrl, safeUrl } from "./url-safety";

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
  stored: string | null | undefined;
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

const FILE_NAME_MAX = 80;
const EDGE_DOTS_AND_SPACE = /^[\s.]+|[\s.]+$/gu;

/**
 * The name a downloaded image saves under: the author's name stripped of
 * characters file systems reject and of bidi controls that could make it
 * display as another extension, or `image`, always ending in `.jpg`.
 */
export function jpegFileName(name: string | undefined): string {
  // Cut by code point: half a surrogate pair makes encodeURIComponent throw.
  const base = Array.from(
    (name ?? "")
      .replace(/[\\/:*?"<>|\p{Cc}\p{Cs}\u202A-\u202E\u2066-\u2069]/gu, "")
      .replace(EDGE_DOTS_AND_SPACE, "")
      .replace(/\.(jpe?g|webp|png|gif|hei[cf]|avif)$/i, ""),
  )
    .slice(0, FILE_NAME_MAX)
    .join("")
    .replace(EDGE_DOTS_AND_SPACE, "");
  return `${base || "image"}.jpg`;
}

export enum ImageSaveKind {
  Download = "download",
  Open = "open",
}

export type ImageSaveTarget =
  | { kind: ImageSaveKind.Download; key: string; url: string; fileName: string }
  | { kind: ImageSaveKind.Open; url: string };

/**
 * What saving an image acts on: a stored image's jpeg download, or any other
 * source as it is, unless its scheme is unsafe. Forms serve sources the way
 * getImageSource renders them, as a cloudfront url in production, so any url
 * shaped like one counts as stored; an external url that only looks like one
 * 404s at the download. A bare key isn't a rendered url; resolve it with
 * resolveUploadSrc first.
 */
export function imageSaveTarget({
  src,
  apiUrl,
  name,
}: {
  src: string;
  apiUrl: string;
  name?: string;
}): Result<ImageSaveTarget, Error> {
  const key = uploadKeyInUrl(src);
  if (key) {
    const fileName = jpegFileName(name);
    return R.success({
      kind: ImageSaveKind.Download,
      key,
      url: `${uploadSrc({ key, apiUrl })}/download?name=${encodeURIComponent(fileName)}`,
      fileName,
    });
  }
  return isSafeUrl(src)
    ? R.success({ kind: ImageSaveKind.Open, url: src })
    : R.failure(new Error("Unsafe image source"));
}

/** Upload keys are unique per upload and never rewritten. */
export const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Covers every avatar size but `huge` at 3x device pixel ratio. Baked into the
 * key rather than negotiated, so changing it means regenerating every
 * thumbnail with server/scripts/backfill-image-thumbnails.ts.
 */
export const THUMBNAIL_WIDTH = 128;

const THUMBNAIL_SUFFIX = `-${THUMBNAIL_WIDTH}.webp`;

/** `{timestamp}-{uuid}.webp` → `{timestamp}-{uuid}-128.webp`. */
export function thumbnailKey(key: string): string {
  return key.replace(/\.webp$/, THUMBNAIL_SUFFIX);
}

export function isThumbnailKey(key: string): boolean {
  return key.endsWith(THUMBNAIL_SUFFIX);
}

/**
 * The thumbnail url for a photo the api rendered, leaving anything else — an
 * external url, a data uri, the default icon — alone. A key uploaded before
 * thumbnails existed has none until the backfill script runs.
 */
export function thumbnailSrc(src: string): string {
  const key = uploadKeyInUrl(src);
  return key ? src.replace(key, thumbnailKey(key)) : src;
}
