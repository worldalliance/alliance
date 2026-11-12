import { User } from "src/user/entities/user.entity";
import request from "supertest";
import {
  closeTestApp,
  createTestApp,
  giveActiveContract,
  signAccessToken,
  type TestContext,
} from "./e2e-test-utils";

describe("Community records across endpoints (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const send = (params: {
    method: "get" | "post" | "patch";
    path: string;
    token: string;
    body?: object;
  }) =>
    request(ctx.app.getHttpServer())
      [params.method](params.path)
      .set("Authorization", `Bearer ${params.token}`)
      .send(params.body);

  const member = async (name: string) => {
    const users = ctx.dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        name,
        email: `${name.toLowerCase().replace(/ /g, ".")}@example.com`,
        password: "Password123!",
      }),
    );
    await giveActiveContract(ctx, user.id);
    return { id: user.id, token: signAccessToken(ctx.jwtService, user) };
  };

  it("sends a community's members the same way from every endpoint members load it from", async () => {
    await giveActiveContract(ctx, ctx.testUserId);
    const leader = ctx.accessToken;
    const created = await send({
      method: "post",
      path: "/community/create",
      token: leader,
      body: {
        name: "Community records",
        description: "Records",
        public: true,
        allowMemberInvites: true,
        allowStaffAssignments: true,
        maxCapacity: 10,
      },
    }).expect(201);
    const communityId: number = created.body.id;
    const joiner = await member("Records Joiner");
    const removee = await member("Records Removee");
    const joined = await send({
      method: "post",
      path: `/community/${communityId}/join`,
      token: joiner.token,
    }).expect(201);
    await send({
      method: "post",
      path: `/community/${communityId}/join`,
      token: removee.token,
    }).expect(201);
    const removed = await send({
      method: "post",
      path: `/community/${communityId}/removeMember`,
      token: leader,
      body: { userId: removee.id },
    }).expect(201);
    const updated = await send({
      method: "patch",
      path: `/community/${communityId}`,
      token: leader,
      body: { description: "Records" },
    }).expect(200);
    const mine = await send({
      method: "get",
      path: "/community/list/my",
      token: leader,
    }).expect(200);
    const listed = await send({
      method: "get",
      path: "/community/list/public",
      token: leader,
    }).expect(200);

    const signed = (id: number) =>
      expect.objectContaining({
        id,
        hasActiveContract: true,
        lastContractEvent: expect.objectContaining({ type: "signed" }),
      });
    const find = (body: { id: number }[]) =>
      body.find(({ id }) => id === communityId);
    const leaderRecord = { users: [signed(ctx.testUserId)] };
    const record = {
      users: expect.arrayContaining([
        signed(ctx.testUserId),
        signed(joiner.id),
      ]),
    };
    expect({
      created: created.body,
      joined: joined.body,
      removed: removed.body,
      updated: updated.body,
      mine: find(mine.body),
      listed: find(listed.body),
    }).toMatchObject({
      created: leaderRecord,
      joined: record,
      removed: record,
      updated: record,
      mine: record,
      listed: record,
    });
  });
});
