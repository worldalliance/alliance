import { LinkOpeningPlatform } from "@alliance/common/linkOpening";
import { randomUUID } from "crypto";
import { LINK_OPENING_THROTTLE } from "src/link-tracking/link-opening-throttle.config";
import { LinkTrackingModule } from "src/link-tracking/link-tracking.module";
import request from "supertest";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Link opening rate limiting (e2e)", () => {
  let ctx: TestContext;
  const limit = LINK_OPENING_THROTTLE.linkOpeningBurst.limit;

  beforeAll(async () => {
    ctx = await createTestApp([LinkTrackingModule], { enableThrottle: true });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const post = () =>
    request(ctx.app.getHttpServer()).post("/link-openings").send({
      openingId: randomUUID(),
      trackingId: "unknownTrackingId1",
      destination: "/tasks",
      platform: LinkOpeningPlatform.Web,
      observedAt: new Date().toISOString(),
    });

  it("answers 429 past the per-minute limit from one IP", async () => {
    for (let n = 0; n < limit; n++) {
      expect((await post()).status).toBe(404);
    }

    expect((await post()).status).toBe(429);
  });
});
