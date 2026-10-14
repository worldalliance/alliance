import type { ThrottlerOptions } from "@nestjs/throttler";
import { milliseconds } from "date-fns";

/**
 * Per IP, since an unlink may arrive with a lapsed session. Loose enough for
 * a shared network signing out, and for a phone retrying a pending unlink.
 */
export const DEVICE_UNLINK_THROTTLE = {
  deviceUnlinkBurst: { limit: 60, ttl: milliseconds({ minutes: 1 }) },
  deviceUnlinkSustained: { limit: 600, ttl: milliseconds({ hours: 1 }) },
} as const satisfies Record<string, ThrottlerOptions>;
