import type { ThrottlerOptions } from "@nestjs/throttler";
import { milliseconds } from "date-fns";

/**
 * Per IP, since openings arrive signed out. Loose enough for a household or
 * office opening its messages, and for a client draining its retry queue.
 */
export const LINK_OPENING_THROTTLE = {
  linkOpeningBurst: { limit: 60, ttl: milliseconds({ minutes: 1 }) },
  linkOpeningSustained: { limit: 600, ttl: milliseconds({ hours: 1 }) },
} as const satisfies Record<string, ThrottlerOptions>;
