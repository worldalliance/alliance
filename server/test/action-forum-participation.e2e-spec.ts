import request from "supertest";
import { Like } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action } from "../src/actions/entities/action.entity";
import {
  createActionAsAdmin,
  getActionAsAdmin,
  patchActionAsAdmin,
} from "./action-requests";
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
    createActionAsAdmin(ctx, {
      name: NAME_PREFIX,
      isForumParticipationAction: true,
      ...body,
    });

  const patch = (id: number, body: Partial<CreateActionDto>) =>
    patchActionAsAdmin(ctx, id, body);

  it("returns false for include children on an action created without it", async () => {
    const created = await create({}).expect(201);
    expect(created.body.forumParticipationIncludeChildren).toBe(false);

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
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

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
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

  it.each(["", "42", 4.2, 0, 2_147_483_648])(
    "rejects a post override of %p",
    async (forumParticipationPostId) => {
      const created = await create({}).expect(201);
      await request(ctx.app.getHttpServer())
        .patch(`/actions/${created.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ forumParticipationPostId })
        .expect(400);
    },
  );

  it("returns null for the autocomplete timestamp on an action created without it", async () => {
    const created = await create({}).expect(201);
    expect(created.body.computedAutocompleteAt).toBeNull();

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
    expect(fetched.body.computedAutocompleteAt).toBeNull();
  });

  it("sets the autocomplete timestamp, keeps it when a patch leaves it out, and clears it with null", async () => {
    const computedAt = "2026-01-02T03:04:05.000Z";
    const created = await create({
      computedAutocompleteAt: new Date(computedAt),
    }).expect(201);
    expect(created.body.computedAutocompleteAt).toBe(computedAt);

    const renamed = await patch(created.body.id, {
      name: `${NAME_PREFIX} renamed`,
    }).expect(200);
    expect(renamed.body.computedAutocompleteAt).toBe(computedAt);

    const cleared = await patch(created.body.id, {
      computedAutocompleteAt: null,
    }).expect(200);
    expect(cleared.body.computedAutocompleteAt).toBeNull();

    const stored = await ctx.dataSource
      .getRepository(Action)
      .findOneByOrFail({ id: created.body.id });
    expect(stored.computedAutocompleteAt).toBeNull();
  });

  it.each(["", "not a date", "1", "2024-02-30", true, 0])(
    "rejects an autocomplete timestamp of %p",
    async (computedAutocompleteAt) => {
      const created = await create({}).expect(201);
      await request(ctx.app.getHttpServer())
        .patch(`/actions/${created.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ computedAutocompleteAt })
        .expect(400);
    },
  );
});
