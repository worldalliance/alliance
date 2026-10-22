import request from "supertest";
import { GeneralUpdate } from "../src/actions/entities/general-update.entity";
import {
  ContractEvent,
  ContractEventType,
} from "../src/user/entities/contract-event.entity";
import { Tag } from "../src/user/entities/tag.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("General update tags (e2e)", () => {
  let ctx: TestContext;
  let otherTag: Tag;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    otherTag = await ctx.dataSource
      .getRepository(Tag)
      .save({ name: "Other Tag", description: "Other Tag" });
    await ctx.dataSource.getRepository(ContractEvent).save({
      type: ContractEventType.SIGNED,
      date: new Date("2020-01-01T00:00:00Z"),
      automatic: false,
      contractId: ctx.defaultContractId,
      user: { id: ctx.testUserId },
    });
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource.getRepository(GeneralUpdate).deleteAll();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const create = (body: object) =>
    request(ctx.app.getHttpServer())
      .post("/actions/generalUpdates/create")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        name: "general-update-tags e2e",
        useManualCohort: false,
        ...body,
      })
      .expect(201);

  const patch = (id: number, body: object) =>
    request(ctx.app.getHttpServer())
      .patch(`/actions/generalUpdates/${id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body)
      .expect(200);

  const tagIdsOf = (body: { tags: { id: string }[] }) =>
    body.tags.map((tag) => tag.id).sort();

  it("returns the tags an admin sets, replaces, and clears", async () => {
    const created = await create({
      tagIds: [ctx.defaultTag.id, otherTag.id],
    });
    const both = [ctx.defaultTag.id, otherTag.id].sort();
    expect(tagIdsOf(created.body)).toEqual(both);

    const fetched = await request(ctx.app.getHttpServer())
      .get(`/actions/generalUpdates/admin/${created.body.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(tagIdsOf(fetched.body)).toEqual(both);

    const listed = await request(ctx.app.getHttpServer())
      .get("/actions/generalUpdates/admin")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(
      tagIdsOf(
        listed.body.find((u: { id: number }) => u.id === created.body.id),
      ),
    ).toEqual(both);

    const renamed = await patch(created.body.id, { name: "Renamed" });
    expect(tagIdsOf(renamed.body)).toEqual(both);

    const replaced = await patch(created.body.id, { tagIds: [otherTag.id] });
    expect(tagIdsOf(replaced.body)).toEqual([otherTag.id]);

    const cleared = await patch(created.body.id, { tagIds: [] });
    expect(cleared.body.tags).toEqual([]);
  });

  it("lists an unread update only to members holding one of its tags", async () => {
    const window = {
      startDate: "2021-01-01T00:00:00.000Z",
      endDate: "2999-01-01T00:00:00.000Z",
    };
    const memberTagged = await create({
      ...window,
      tagIds: [ctx.defaultTag.id],
    });
    const otherTagged = await create({ ...window, tagIds: [otherTag.id] });

    const unread = await request(ctx.app.getHttpServer())
      .get("/actions/generalUpdates/unread")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    const ids = unread.body.map((u: { id: number }) => u.id);
    expect(ids).toContain(memberTagged.body.id);
    expect(ids).not.toContain(otherTagged.body.id);
  });
});
