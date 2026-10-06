/**
 * An uploaded video's storage key, or a direct storage url for one, which
 * forms saved while playback bypassed the api still name. Playing those
 * through the api is what makes a deleted video unavailable.
 */
const UPLOADED_VIDEO_SOURCE =
  /^(?:https:\/\/[a-z0-9-]+\.cloudfront\.net\/)?(videos\/\d+)\/?$/;

export function uploadedVideoKey(src: string): string | undefined {
  return UPLOADED_VIDEO_SOURCE.exec(src)?.[1];
}
