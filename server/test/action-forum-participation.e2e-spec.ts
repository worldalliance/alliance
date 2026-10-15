import request from "supertest";
import { Like } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-forum-participation e2e";

describe("Action forum participation settings (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource
      .getRepository(Action)
      .delete({ name: Like(`${NAME_PREFIX}%`) });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const create = (body: Partial<CreateActionDto>) =>
    request(ctx.app.getHttpServer())
      .post("/actions/create")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        name: NAME_PREFIX,
        body: "Body",
        category: [],
        shortDescription: "Short",
        visibilityMode: VisibilityMode.Public,
        isContractSigningAction: false,
        shouldCompleteAfterDeadline: false,
        isForumParticipationAction: true,
        optional: false,
        preventCompletion: false,
        publicOnly: false,
        onboarding: false,
        ...body,
      } satisfies CreateActionDto);

  const patch = (id: number, body: Partial<CreateActionDto>) =>
    request(ctx.app.getHttpServer())
      .patch(`/actions/${id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  const getAdmin = (id: number) =>
    request(ctx.app.getHttpServer())
      .get(`/actions/adminslug/${id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  it("returns false for include children on an action created without it", async () => {
    const created = await create({}).expect(201);
    expect(created.body.forumParticipationIncludeChildren).toBe(false);

    const fetched = await getAdmin(created.body.id).expect(200);
    expect(fetched.body.forumParticipationIncludeChildren).toBe(false);
  });

  it("sets include children and keeps it when a patch leaves it out", async () => {
    const created = await create({
      forumParticipationIncludeChildren: true,
    }).expect(201);
    expect(created.body.forumParticipationIncludeChildren).toBe(true);

    const renamed = await patch(created.body.id, {
      name: `${NAME_PREFIX} renamed`,
    }).expect(200);
    expect(renamed.body.forumParticipationIncludeChildren).toBe(true);

    const cleared = await patch(created.body.id, {
      forumParticipationIncludeChildren: false,
    }).expect(200);
    expect(cleared.body.forumParticipationIncludeChildren).toBe(false);

    const stored = await ctx.dataSource
      .getRepository(Action)
      .findOneByOrFail({ id: created.body.id });
    expect(stored.forumParticipationIncludeChildren).toBe(false);
  });

  it("returns null for the post override on an action created without it", async () => {
    const created = await create({}).expect(201);
    expect(created.body.forumParticipationPostId).toBeNull();

    const fetched = await getAdmin(created.body.id).expect(200);
    expect(fetched.body.forumParticipationPostId).toBeNull();
  });

  it("sets the post override, keeps it when a patch leaves it out, and clears it with null", async () => {
    const created = await create({ forumParticipationPostId: 42 }).expect(201);
    expect(created.body.forumParticipationPostId).toBe(42);

    const renamed = await patch(created.body.id, {
      name: `${NAME_PREFIX} renamed`,
    }).expect(200);
    expect(renamed.body.forumParticipationPostId).toBe(42);

    const cleared = await patch(created.body.id, {
      forumParticipationPostId: null,
    }).expect(200);
    expect(cleared.body.forumParticipationPostId).toBeNull();

    const stored = await ctx.dataSource
      .getRepository(Action)
      .findOneByOrFail({ id: created.body.id });
    expect(stored.forumParticipationPostId).toBeNull();
  });
});
