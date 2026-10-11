import request from "supertest";
import { Like } from "typeorm";
import { GeneralUpdate } from "../src/actions/entities/general-update.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "general-update-dates e2e";

describe("General update dates (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource
      .getRepository(GeneralUpdate)
      .delete({ name: Like(`${NAME_PREFIX}%`) });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const create = (body: object) =>
    request(ctx.app.getHttpServer())
      .post("/actions/generalUpdates/create")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ name: NAME_PREFIX, useManualCohort: false, ...body });

  const patch = (id: number, body: object) =>
    request(ctx.app.getHttpServer())
      .patch(`/actions/generalUpdates/${id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  const getAdmin = (id: number) =>
    request(ctx.app.getHttpServer())
      .get(`/actions/generalUpdates/admin/${id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  it("returns null dates for an update created without them", async () => {
    const created = await create({}).expect(201);
    expect(created.body.startDate).toBeNull();
    expect(created.body.endDate).toBeNull();

    const fetched = await getAdmin(created.body.id).expect(200);
    expect(fetched.body.startDate).toBeNull();
    expect(fetched.body.endDate).toBeNull();
  });

  it("clears a date patched to null and keeps one left out", async () => {
    const startDate = "2026-01-02T03:04:05.000Z";
    const endDate = "2999-02-03T04:05:06.000Z";
    const created = await create({ startDate, endDate }).expect(201);
    expect(created.body).toMatchObject({ startDate, endDate });

    const patched = await patch(created.body.id, { endDate: null }).expect(200);
    expect(patched.body).toMatchObject({ startDate, endDate: null });

    const stored = await ctx.dataSource
      .getRepository(GeneralUpdate)
      .findOneByOrFail({ id: created.body.id });
    expect(stored.startDate?.toISOString()).toBe(startDate);
    expect(stored.endDate).toBeNull();
  });

  it("lists a started update without an end date to members", async () => {
    const created = await create({
      startDate: "2026-01-02T03:04:05.000Z",
    }).expect(201);

    const listed = await request(ctx.app.getHttpServer())
      .get("/actions/generalUpdates")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    const update = listed.body.find(
      (u: { id: number }) => u.id === created.body.id,
    );
    expect(update).toMatchObject({
      startDate: "2026-01-02T03:04:05.000Z",
      endDate: null,
    });
  });
});
