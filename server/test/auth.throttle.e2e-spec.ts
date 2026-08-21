import request from "supertest";
import { SIGNUP_THROTTLE } from "../src/auth/signup-throttle.config";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Auth register rate limiting (e2e)", () => {
  let ctx: TestContext;
  const burstLimit = SIGNUP_THROTTLE.signupBurst.limit as number;

  beforeAll(async () => {
    // Opt into the real ThrottlerGuard. All supertest requests share one source
    // IP, so they land in a single per-IP bucket.
    ctx = await createTestApp([], { enableThrottle: true });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const register = (n: number) =>
    request(ctx.app.getHttpServer())
      .post("/auth/register")
      .send({
        email: `throttle-${n}@test.com`,
        password: "password",
        name: `Throttle User ${n}`,
        mode: "header",
      });

  it(`blocks with 429 once the burst limit (${burstLimit}/min) is exceeded`, async () => {
    // The guard runs before the route handler, so every request consumes a slot
    // regardless of how the handler itself responds. The first `burstLimit`
    // requests must get through the guard (any non-429 status); the next one is
    // rejected by the limiter.
    for (let n = 0; n < burstLimit; n++) {
      const res = await register(n);
      expect(res.status).not.toBe(429);
    }

    const blocked = await register(burstLimit);
    expect(blocked.status).toBe(429);
  });
});
