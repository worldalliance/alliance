import { GeoModule } from "src/geo/geo.module";
import request from "supertest";
import { createTestApp, TestContext } from "./e2e-test-utils";
describe.skip("Geo (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([GeoModule]);
  }, 50000);

  it("should search for cities", async () => {
    const cities = await request(ctx.app.getHttpServer())
      .get("/geo/search-city?query=Palo")
      .expect(200);

    console.log(cities.body);

    expect(cities).toBeDefined();
  });
});
