import { applyDecorators, Injectable } from "@nestjs/common";
import {
  SkipThrottle,
  Throttle,
  ThrottlerGuard,
  type ThrottlerOptions,
} from "@nestjs/throttler";
import {
  ACTION_PARTNERSHIP_RESPONSE_THROTTLE,
  JOIN_REQUEST_THROTTLE,
  SIGNUP_THROTTLE,
} from "src/auth/signup-throttle.config";
import { LINK_PREVIEW_THROTTLE } from "src/link-preview/link-preview-throttle.config";

/**
 * Every named throttler in the app. `ThrottlerModule.forRoot` must be fed
 * from this registry (via {@link ALL_THROTTLERS}) — a throttle group that
 * bypasses it breaks the skip lists {@link OnlyThrottle} derives from it.
 */
export const ALL_THROTTLES: Record<string, ThrottlerOptions> = {
  ...SIGNUP_THROTTLE,
  ...ACTION_PARTNERSHIP_RESPONSE_THROTTLE,
  ...JOIN_REQUEST_THROTTLE,
  ...LINK_PREVIEW_THROTTLE,
};

/** Array form expected by `ThrottlerModule.forRoot()`. */
export const ALL_THROTTLERS = Object.entries(ALL_THROTTLES).map(
  ([name, options]) => ({ name, ...options }),
);

/**
 * Applies one throttle group to a route and skips every other registered
 * group. Use this instead of a bare `@Throttle`: `ThrottlerGuard` enforces
 * EVERY throttler registered in `ThrottlerModule.forRoot` on any route it
 * guards — `@Throttle(subset)` only overrides the limits for the names it
 * mentions, so the other groups' defaults would still apply (e.g. the
 * 3/minute action-partnership limit would silently cap an unrelated route).
 */
export function OnlyThrottle(
  throttles: Record<string, ThrottlerOptions>,
): MethodDecorator & ClassDecorator {
  // A group missing from ALL_THROTTLES is never registered with
  // ThrottlerModule, so its limits would be ignored while the skip list
  // below still disables every registered throttler — leaving the route
  // with no rate limit at all. Decorators run at import time, so this
  // throws at boot rather than shipping an unthrottled route.
  const unregistered = Object.keys(throttles).filter(
    (name) => !(name in ALL_THROTTLES),
  );
  if (unregistered.length > 0) {
    throw new Error(
      `Throttle group not registered in ALL_THROTTLES: ${unregistered.join(", ")}`,
    );
  }
  const others = Object.keys(ALL_THROTTLES).filter(
    (name) => !(name in throttles),
  );
  return applyDecorators(
    Throttle(throttles),
    SkipThrottle(Object.fromEntries(others.map((name) => [name, true]))),
  );
}

/**
 * `ThrottlerGuard` keyed by the authenticated user instead of the client IP.
 * For routes behind `AuthGuard`, per-IP buckets are the wrong shape in both
 * directions: distinct users behind one NAT share a bucket, while one user
 * rotating IPs gets a fresh bucket each time. List it AFTER `AuthGuard` in
 * `@UseGuards` so `request.user` is populated; requests with no user fall
 * back to the IP. The prefixes keep the two key spaces disjoint.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, unknown>,
  ): Promise<string> {
    const sub = (req.user as { sub?: unknown } | undefined)?.sub;
    return typeof sub === "number" || typeof sub === "string"
      ? `user:${sub}`
      : `ip:${String(req.ip)}`;
  }
}
