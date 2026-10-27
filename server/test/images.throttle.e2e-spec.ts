import { IMAGE_DOWNLOAD_THROTTLE } from "src/images/image-download-throttle.config";
import { ImagesModule } from "src/images/images.module";
import request from "supertest";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Image download rate limiting (e2e)", () => {
  let ctx: TestContext;
  const limit = IMAGE_DOWNLOAD_THROTTLE.imageDownloadBurst.limit;

  beforeAll(async () => {
    ctx = await createTestApp([ImagesModule], { enableThrottle: true });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const download = () =>
    request(ctx.app.getHttpServer()).get(
      `/images/${encodeURIComponent("a:b")}/download`,
    );

  it("answers 429 past the per-minute limit from one IP", async () => {
    for (let n = 0; n < limit; n++) {
      expect((await download()).status).toBe(404);
    }

    expect((await download()).status).toBe(429);
  });
});
