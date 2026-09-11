import type { ThrottlerOptions } from "@nestjs/throttler";
import { milliseconds } from "date-fns";

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
  signupBurst: { limit: 5, ttl: milliseconds({ minutes: 1 }) },
  signupSustained: { limit: 20, ttl: milliseconds({ hours: 1 }) },
};

export const ACTION_PARTNERSHIP_RESPONSE_THROTTLE: Record<
  string,
  ThrottlerOptions
> = {
  actionPartnershipResponseBurst: {
    limit: 3,
    ttl: milliseconds({ minutes: 1 }),
  },
  actionPartnershipResponseSustained: {
    limit: 10,
    ttl: milliseconds({ hours: 1 }),
  },
};

export const JOIN_REQUEST_THROTTLE: Record<string, ThrottlerOptions> = {
  joinRequestBurst: { limit: 3, ttl: milliseconds({ minutes: 1 }) },
  joinRequestSustained: { limit: 10, ttl: milliseconds({ hours: 1 }) },
};

/**
 * Sign-in through a provider. Looser than {@link SIGNUP_THROTTLE} because
 * /start is one click of a login button, not a registration, and a roomful of
 * members behind one NAT shares the bucket.
 */
export const OAUTH_THROTTLE: Record<string, ThrottlerOptions> = {
  oauthBurst: { limit: 30, ttl: milliseconds({ minutes: 1 }) },
  oauthSustained: { limit: 200, ttl: milliseconds({ hours: 1 }) },
};
