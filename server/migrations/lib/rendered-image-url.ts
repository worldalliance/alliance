// Frozen helpers for the migrations that rewrite an image column back to upload
// keys. They live outside `migrations/*.ts` because TypeORM instantiates every
// export it finds there. Application code must not import them, and their
// behavior must not change once the migrations have run.

// The three shapes getImageSource renders an upload key as: a cloudfront url,
// `{APP_URL}/api/images/{key}`, and `http://localhost:{port}/images/{key}`.
export const URL_PREFIX = "^https?://[^/]+/(?:api/images/|images/)?";

// A key is `{timestamp}.webp`, or `{timestamp}-{uuid}.webp` since newImageKey
// started appending a uuid. Matching that shape rather than any single path
// segment leaves an external url alone even when its path is one `.webp` file.
const UPLOAD_KEY =
  "[0-9]+(?:-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})?\\.webp";

export const RENDERED_KEY_URL = `${URL_PREFIX}${UPLOAD_KEY}$`;
