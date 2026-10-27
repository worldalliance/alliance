import type { ThrottlerOptions } from "@nestjs/throttler";
import { milliseconds } from "date-fns";

/**
 * Per IP, since public forms are read signed out. Each download decodes and
 * re-encodes the image; jpegDownload's queue bounds how many run at once.
 */
export const IMAGE_DOWNLOAD_THROTTLE = {
  imageDownloadBurst: { limit: 30, ttl: milliseconds({ minutes: 1 }) },
  imageDownloadSustained: { limit: 300, ttl: milliseconds({ hours: 1 }) },
} as const satisfies Record<string, ThrottlerOptions>;
