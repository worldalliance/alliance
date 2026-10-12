import request from "supertest";
import { Like } from "typeorm";
import { GeneralUpdate } from "../src/actions/entities/general-update.entity";
import {
  ContractEvent,
  ContractEventType,
} from "../src/user/entities/contract-event.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "general-update-manual-cohort e2e";

describe("General update manual cohort (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    await ctx.dataSource.getRepository(ContractEvent).save({
      type: ContractEventType.SIGNED,
      date: new Date("2020-01-01T00:00:00Z"),
      automatic: false,
      contractId: ctx.defaultContractId,
      user: { id: ctx.testUserId },
    });
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

  it("returns null user ids for an update created without them", async () => {
    const created = await create({}).expect(201);
    expect(created.body.manualCohortUserIds).toBeNull();

    const fetched = await getAdmin(created.body.id).expect(200);
    expect(fetched.body.manualCohortUserIds).toBeNull();
  });

  it("clears user ids patched to null and keeps them when left out", async () => {
    const created = await create({
      useManualCohort: true,
      manualCohortUserIds: [ctx.testUserId],
    }).expect(201);
    expect(created.body.manualCohortUserIds).toEqual([ctx.testUserId]);

    const renamed = await patch(created.body.id, {
      name: `${NAME_PREFIX} renamed`,
    }).expect(200);
    expect(renamed.body.manualCohortUserIds).toEqual([ctx.testUserId]);

    const cleared = await patch(created.body.id, {
      manualCohortUserIds: null,
    }).expect(200);
    expect(cleared.body.manualCohortUserIds).toBeNull();

    const stored = await ctx.dataSource
      .getRepository(GeneralUpdate)
      .findOneByOrFail({ id: created.body.id });
    expect(stored.manualCohortUserIds).toBeNull();
  });

  it("shows a manual-cohort update with null user ids to no member", async () => {
    const startDate = "2026-01-02T03:04:05.000Z";
    const tagIds = [ctx.defaultTag.id];
    const inCohort = await create({
      name: `${NAME_PREFIX} in cohort`,
      useManualCohort: true,
      manualCohortUserIds: [ctx.testUserId],
      startDate,
    }).expect(201);
    const tagged = await create({
      name: `${NAME_PREFIX} tagged`,
      tagIds,
      startDate,
    }).expect(201);
    await create({
      name: `${NAME_PREFIX} null`,
      useManualCohort: true,
      tagIds,
      startDate,
    }).expect(201);

    const listed = await request(ctx.app.getHttpServer())
      .get("/actions/generalUpdates/unread")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    expect(
      listed.body
        .filter((u: { name: string }) => u.name.startsWith(NAME_PREFIX))
        .map((u: { id: number }) => u.id)
        .sort(),
    ).toEqual([inCohort.body.id, tagged.body.id].sort());
  });
});
