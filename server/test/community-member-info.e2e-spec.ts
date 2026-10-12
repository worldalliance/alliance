import request from "supertest";
import { In, Not, type Repository } from "typeorm";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import { Community } from "../src/community/entities/community.entity";
import { User } from "../src/user/entities/user.entity";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

describe("Community member info (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let communityRepo: Repository<Community>;
  let actionRepo: Repository<Action>;
  let member: User;
  let otherMember: User;
  let outsider: User;
  let community: Community;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
    communityRepo = ctx.dataSource.getRepository(Community);
    actionRepo = ctx.dataSource.getRepository(Action);
  }, 50000);

  beforeEach(async () => {
    [member, otherMember, outsider] = await userRepo.save(
      ["Member", "Other Member", "Outsider"].map((name, i) =>
        userRepo.create({
          name,
          email: `member-info-${i}@example.com`,
          password: "Password123!",
        }),
      ),
    );
    community = await communityRepo.save(
      communityRepo.create({
        name: "Member Info Group",
        leaders: [member],
        users: [member, otherMember],
      }),
    );
    // Members are only listed against at least one live action.
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Member Info Action",
        category: [],
        body: "Body copy",
        shortDescription: "Short description",
        visibilityMode: VisibilityMode.Public,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      }),
    );
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Launch",
      description: "Action live",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - 1000),
      action,
    });
  });

  afterEach(async () => {
    await actionRepo.createQueryBuilder().delete().execute();
    await communityRepo.createQueryBuilder().delete().execute();
    await userRepo.delete({
      id: Not(In([ctx.testUserId, ctx.adminUserId])),
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const memberIds = (res: request.Response) =>
    new Set(res.body.users.map((user: { userId: number }) => user.userId));

  it("lists every member to a member", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/actions/communityMemberInfo/${community.id}`)
      .set(
        "Authorization",
        `Bearer ${signAccessToken(ctx.jwtService, otherMember)}`,
      );

    expect(res.status).toBe(200);
    expect(memberIds(res)).toEqual(new Set([member.id, otherMember.id]));
  });

  it("returns 404 to someone outside the group", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/actions/communityMemberInfo/${community.id}`)
      .set(
        "Authorization",
        `Bearer ${signAccessToken(ctx.jwtService, outsider)}`,
      );

    expect(res.status).toBe(404);
  });

  it("lists every member to an admin", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/actions/communityMemberInfo/${community.id}/admin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(memberIds(res)).toEqual(new Set([member.id, otherMember.id]));
  });
});
