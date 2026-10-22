import type { ThrottlerOptions } from "@nestjs/throttler";
import { milliseconds } from "date-fns";

/**
 * Registered in `ThrottlerModule.forRoot` via `ALL_THROTTLERS` and applied
 * to the route with `@OnlyThrottle` — see `src/utils/throttle`. Enforced by
 * `UserThrottlerGuard`, so the limits are per authenticated user.
 */
export const LINK_PREVIEW_THROTTLE = {
  linkPreviewBurst: { limit: 30, ttl: milliseconds({ minutes: 1 }) },
  linkPreviewSustained: { limit: 300, ttl: milliseconds({ hours: 1 }) },
} as const satisfies Record<string, ThrottlerOptions>;
