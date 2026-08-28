import type { ThrottlerOptions } from "@nestjs/throttler";

/**
 * Rate limits for the public `/auth/register` endpoint.
 *
 * Two independent named throttlers are enforced together: a short burst limit
 * and a longer sustained limit. They must be distinct names — stacking two
 * limits under the same throttler name silently overwrites one with the other.
 *
 * Registered in `ThrottlerModule.forRoot` via `ALL_THROTTLERS` (every new
 * group must be added there), and applied to the route with `@OnlyThrottle`
 * so the other groups' limits don't stack onto it — see `src/utils/throttle`.
 */
export const SIGNUP_THROTTLE: Record<string, ThrottlerOptions> = {
  signupBurst: { limit: 5, ttl: 60 * 1000 }, // 5 per minute
  signupSustained: { limit: 20, ttl: 60 * 60 * 1000 }, // 20 per hour
};

export const ACTION_PARTNERSHIP_RESPONSE_THROTTLE: Record<
  string,
  ThrottlerOptions
> = {
  actionPartnershipResponseBurst: { limit: 3, ttl: 60 * 1000 }, // 3 per minute
  actionPartnershipResponseSustained: { limit: 10, ttl: 60 * 60 * 1000 }, // 10 per hour
};

export const JOIN_REQUEST_THROTTLE: Record<string, ThrottlerOptions> = {
  joinRequestBurst: { limit: 3, ttl: 60 * 1000 }, // 3 per minute
  joinRequestSustained: { limit: 10, ttl: 60 * 60 * 1000 }, // 10 per hour
};
