import { Community } from "src/community/entities/community.entity";
import { CommunityConversationService } from "src/messaging/community-conversation.service";
import { ConversationService } from "src/messaging/conversation.service";
import { Conversation } from "src/messaging/entities/conversation.entity";
import { Participant } from "src/messaging/entities/participant.entity";
import { MessagingModule } from "src/messaging/messaging.module";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import {
  closeTestApp,
  createTestApp,
  signAccessToken,
  TestContext,
} from "./e2e-test-utils";

describe("Conversation records across endpoints (e2e)", () => {
  let ctx: TestContext;
  let userCounter = 0;

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const send = (params: {
    method: "get" | "post" | "delete";
    path: string;
    token: string;
    body?: object;
  }) =>
    request(ctx.app.getHttpServer())
      [params.method](`/messaging${params.path}`)
      .set("Authorization", `Bearer ${params.token}`)
      .send(params.body);

  const member = async () => {
    userCounter += 1;
    const users = ctx.dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        name: `Records Member ${userCounter}`,
        email: `records.member${userCounter}@example.com`,
        password: "pass",
        tags: [ctx.defaultTag],
      }),
    );
    return { user, token: signAccessToken(ctx.jwtService, user) };
  };

  const listed = async (params: { token: string; conversationId: number }) => {
    const list = await send({
      method: "get",
      path: "/conversations",
      token: params.token,
    }).expect(200);
    return list.body.find(
      ({ id }: { id: number }) => id === params.conversationId,
    );
  };

  it("sends a group chat's last message and unread count from every write that returns it", async () => {
    const owner = ctx.accessToken;
    const writer = await member();
    const removee = await member();
    const added = await member();
    const created = await send({
      method: "post",
      path: "/conversations/group",
      token: owner,
      body: {
        title: "Records",
        participantIds: [writer.user.id, removee.user.id],
      },
    }).expect(201);
    const conversationId: number = created.body.id;
    await send({
      method: "post",
      path: "/messages",
      token: writer.token,
      body: { conversationId, body: "Unread" },
    }).expect(201);

    const renamed = await send({
      method: "post",
      path: `/conversations/${conversationId}/update`,
      token: owner,
      body: { title: "Renamed" },
    }).expect(201);
    const withAdded = await send({
      method: "post",
      path: `/conversations/${conversationId}/participants`,
      token: owner,
      body: { userId: added.user.id },
    }).expect(201);
    const removed = await send({
      method: "delete",
      path: `/conversations/${conversationId}/participants/${removee.user.id}`,
      token: owner,
    }).expect(200);
    const record = await listed({ token: owner, conversationId });

    expect(record).toMatchObject({
      unreadCount: 1,
      lastMessage: expect.objectContaining({ body: "Unread" }),
    });
    const messageFields = {
      lastMessage: record.lastMessage,
      unreadCount: record.unreadCount,
      hasUnread: record.hasUnread,
    };
    expect(renamed.body).toMatchObject(messageFields);
    expect(withAdded.body).toMatchObject(messageFields);
    expect(removed.body).toEqual(record);
  });

  it("answers 403 to an admin removed mid-rename, though the rename persists", async () => {
    const created = await send({
      method: "post",
      path: "/conversations/group",
      token: ctx.accessToken,
      body: { title: "Raced", participantIds: [(await member()).user.id] },
    }).expect(201);
    const conversationService = ctx.app.get(ConversationService);
    const ensureAdmin =
      conversationService.ensureConversationAdmin.bind(conversationService);
    const removedMidway = jest
      .spyOn(conversationService, "ensureConversationAdmin")
      .mockImplementationOnce(async (conversationId, userId) => {
        const participant = await ensureAdmin(conversationId, userId);
        await ctx.dataSource.getRepository(Participant).remove(participant);
        return participant;
      });

    await send({
      method: "post",
      path: `/conversations/${created.body.id}/update`,
      token: ctx.accessToken,
      body: { title: "Renamed" },
    }).expect(403);
    removedMidway.mockRestore();
    expect(
      await ctx.dataSource
        .getRepository(Conversation)
        .findOneByOrFail({ id: created.body.id }),
    ).toMatchObject({ title: "Renamed" });
  });

  it("sends a started direct chat as the list does", async () => {
    const target = await member();

    const created = await send({
      method: "post",
      path: "/conversations/direct",
      token: ctx.accessToken,
      body: { targetUserId: target.user.id },
    }).expect(201);

    expect(created.body).toEqual(
      await listed({ token: ctx.accessToken, conversationId: created.body.id }),
    );
  });

  it("sends a group's chat as the list does, before and after it is read", async () => {
    const leader = await member();
    const reader = await member();
    const communities = ctx.dataSource.getRepository(Community);
    const community = await communities.save(
      communities.create({
        name: "Records Community",
        description: "Records",
        public: false,
        allowMemberInvites: false,
        allowStaffAssignments: false,
        users: [leader.user, reader.user],
        leaders: [leader.user],
      }),
    );
    const { id: conversationId } = await ctx.app
      .get(CommunityConversationService)
      .syncCommunityConversationMembers(community.id);
    await send({
      method: "post",
      path: "/messages",
      token: leader.token,
      body: { conversationId, body: "Welcome" },
    }).expect(201);

    const group = await send({
      method: "get",
      path: `/conversations/community/${community.id}`,
      token: reader.token,
    }).expect(200);
    const unread = await listed({ token: reader.token, conversationId });
    const read = await send({
      method: "post",
      path: `/conversations/${conversationId}/read`,
      token: reader.token,
    }).expect(201);

    expect(unread).toMatchObject({ unreadCount: 1 });
    expect(group.body).toEqual(unread);
    expect(read.body).toEqual(
      await listed({ token: reader.token, conversationId }),
    );
  });
});
