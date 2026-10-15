import request from "supertest";
import {
  OAUTH_THROTTLE,
  SIGNUP_THROTTLE,
} from "../src/auth/signup-throttle.config";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Auth rate limiting (e2e)", () => {
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
        timeZone: "America/Los_Angeles",
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

  it("limits the review-account handoff", async () => {
    const reviewLogin = () =>
      request(ctx.app.getHttpServer())
        .post("/auth/review-login")
        .type("form")
        .send({ email: "reviewer@example.com", password: "password" });
    const limit = OAUTH_THROTTLE.oauthBurst.limit as number;

    for (let n = 0; n < limit; n++) {
      expect((await reviewLogin()).status).not.toBe(429);
    }

    expect((await reviewLogin()).status).toBe(429);
  });
});
