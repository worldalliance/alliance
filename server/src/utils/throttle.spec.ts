import "reflect-metadata";
import {
  ACTION_PARTNERSHIP_RESPONSE_THROTTLE,
  SIGNUP_THROTTLE,
} from "src/auth/signup-throttle.config";
import { LINK_PREVIEW_THROTTLE } from "src/link-preview/link-preview-throttle.config";
import { ALL_THROTTLES, OnlyThrottle, UserThrottlerGuard } from "./throttle";

// Metadata keys from @nestjs/throttler's internals (not re-exported from the
// package root). `ThrottlerGuard` reads `THROTTLER:LIMIT<name>` and
// `THROTTLER:SKIP<name>` off the handler for every registered throttler.
const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_SKIP = "THROTTLER:SKIP";

class TestController {
  @OnlyThrottle(LINK_PREVIEW_THROTTLE)
  handler() {}
}

describe("OnlyThrottle", () => {
  const handler = TestController.prototype.handler;

  it("applies the limits of the given group", () => {
    for (const [name, options] of Object.entries(LINK_PREVIEW_THROTTLE)) {
      expect(Reflect.getMetadata(THROTTLER_LIMIT + name, handler)).toBe(
        options.limit,
      );
      expect(Reflect.getMetadata(THROTTLER_SKIP + name, handler)).toBe(
        undefined,
      );
    }
  });

  it("skips every other registered throttler", () => {
    const others = Object.keys(ALL_THROTTLES).filter(
      (name) => !(name in LINK_PREVIEW_THROTTLE),
    );
    expect(others.length).toBeGreaterThan(0);
    for (const name of others) {
      expect(Reflect.getMetadata(THROTTLER_SKIP + name, handler)).toBe(true);
    }
  });

  // A group that bypasses ALL_THROTTLES is never registered with
  // ThrottlerModule, so the route would silently end up with no rate limit
  // at all — refuse it at decoration (i.e. boot) time instead.
  it("throws for a group not registered in ALL_THROTTLES", () => {
    expect(() =>
      OnlyThrottle({ rogueBurst: { limit: 5, ttl: 60 * 1000 } }),
    ).toThrow("Throttle group not registered in ALL_THROTTLES: rogueBurst");
  });
});

describe("ALL_THROTTLES", () => {
  it("has no name collisions between groups (spreading would silently drop one)", () => {
    const groups = [
      SIGNUP_THROTTLE,
      ACTION_PARTNERSHIP_RESPONSE_THROTTLE,
      LINK_PREVIEW_THROTTLE,
    ];
    const totalNames = groups.reduce(
      (count, group) => count + Object.keys(group).length,
      0,
    );
    expect(Object.keys(ALL_THROTTLES)).toHaveLength(totalNames);
  });
});

describe("UserThrottlerGuard", () => {
  // getTracker never touches the module options, storage, or reflector.
  const guard = new UserThrottlerGuard(
    { throttlers: [] },
    undefined as never,
    undefined as never,
  );
  const getTracker = (req: Record<string, unknown>) => guard["getTracker"](req);

  it("tracks authenticated requests by user id, not IP", async () => {
    await expect(
      getTracker({ user: { sub: 42 }, ip: "203.0.113.7" }),
    ).resolves.toBe("user:42");
    // Same user from a different address lands in the same bucket.
    await expect(
      getTracker({ user: { sub: 42 }, ip: "198.51.100.9" }),
    ).resolves.toBe("user:42");
  });

  it("falls back to the IP when no user is attached", async () => {
    await expect(getTracker({ ip: "203.0.113.7" })).resolves.toBe(
      "ip:203.0.113.7",
    );
  });

  // A user id that textually equals another request's IP must not share a
  // bucket with it — the prefixes keep the key spaces disjoint.
  it("never collides user and IP buckets", async () => {
    const asUser = await getTracker({ user: { sub: "203.0.113.7" } });
    const asIp = await getTracker({ ip: "203.0.113.7" });
    expect(asUser).not.toBe(asIp);
  });
});
