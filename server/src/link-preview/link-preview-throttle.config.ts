import type { ThrottlerOptions } from "@nestjs/throttler";

/**
 * Registered in `ThrottlerModule.forRoot` via `ALL_THROTTLERS` and applied
 * to the route with `@OnlyThrottle` — see `src/utils/throttle`. Enforced by
 * `UserThrottlerGuard`, so the limits are per authenticated user.
 */
export const LINK_PREVIEW_THROTTLE = {
  linkPreviewBurst: { limit: 30, ttl: 60 * 1000 }, // 30 per minute per user
  linkPreviewSustained: { limit: 300, ttl: 60 * 60 * 1000 }, // 300 per hour per user
} as const satisfies Record<string, ThrottlerOptions>;
