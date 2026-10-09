import { NotFoundException } from "@nestjs/common";
import { Community } from "src/community/entities/community.entity";
import { ConversationService } from "src/messaging/conversation.service";
import {
  ConversationAdminSummaryDto,
  ConversationDto,
  MessageDto,
} from "src/messaging/dto/messaging.dto";
import { Message } from "src/messaging/entities/message.entity";
import {
  Participant,
  ParticipantState,
} from "src/messaging/entities/participant.entity";
import { MessagingModule } from "src/messaging/messaging.module";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  createTestApp,
  signAccessToken,
  TestContext,
  waitForLockWait,
} from "./e2e-test-utils";

describe("Messaging soft deletion (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let messageRepo: Repository<Message>;
  let users = 0;

  const server = () => ctx.app.getHttpServer();

  const createChat = async () => {
    const [leader, member] = await Promise.all(
      [0, 1].map(() =>
        userRepo.save(
          userRepo.create({
            name: `Chat Member ${users}`,
            email: `messaging-soft-delete-${users++}@example.com`,
            password: "password",
          }),
        ),
      ),
    );
    const community = await ctx.dataSource.getRepository(Community).save({
      name: "Chat",
      description: "A community with a chat.",
      public: false,
      allowMemberInvites: false,
      allowStaffAssignments: false,
      users: [leader, member],
      leaders: [leader],
    });
    const conversation = await ctx.app
      .get(ConversationService)
      .syncCommunityConversationMembers(community.id);
    return {
      communityId: community.id,
      conversationId: conversation.id,
      leader,
      leaderToken: signAccessToken(ctx.jwtService, leader),
      member,
      memberToken: signAccessToken(ctx.jwtService, member),
    };
  };

  const send = (params: {
    token: string;
    conversationId: number;
    body: string;
    replyToId?: string;
  }) =>
    request(server())
      .post("/messaging/messages")
      .set("Authorization", `Bearer ${params.token}`)
      .send({
        conversationId: params.conversationId,
        body: params.body,
        replyToId: params.replyToId,
      });

  const sent = async (params: Parameters<typeof send>[0]): Promise<string> =>
    (await send(params).expect(201)).body.id;

  const hide = (...ids: string[]) =>
    Promise.all(
      ids.map((id) => messageRepo.update(id, { deletedAt: new Date() })),
    );

  const listing = async (token: string): Promise<ConversationDto> =>
    (
      await request(server())
        .get("/messaging/conversations")
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
    ).body[0];

  const unreadSummary = async (token: string): Promise<number> =>
    (
      await request(server())
        .get("/messaging/conversations/unread-summary")
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
    ).body.messageCount;

  const unreadCount = async (token: string): Promise<number> =>
    (
      await request(server())
        .get("/messaging/conversations/unread")
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
    ).body.count;

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    userRepo = ctx.dataSource.getRepository(User);
    messageRepo = ctx.dataSource.getRepository(Message);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("hides deleted messages from lists, previews, and reply quotes", async () => {
    const chat = await createChat();
    const memberSays = (body: string, replyToId?: string) =>
      sent({
        token: chat.memberToken,
        conversationId: chat.conversationId,
        body,
        replyToId,
      });
    const quoted = await memberSays("quoted");
    const reply = await memberSays("reply", quoted);
    const latest = await memberSays("latest");

    await hide(quoted, latest);

    for (const path of [
      `/messaging/messages/${chat.conversationId}`,
      `/messaging/messages/admin/${chat.conversationId}`,
    ]) {
      const messages: MessageDto[] = (
        await request(server())
          .get(path)
          .set(
            "Authorization",
            `Bearer ${path.includes("admin") ? ctx.adminAccessToken : chat.leaderToken}`,
          )
          .expect(200)
      ).body;
      expect(messages.map((message) => message.id)).toEqual([reply]);
      expect(messages[0].replyTo).toBeFalsy();
    }
    expect((await listing(chat.leaderToken)).lastMessage?.id).toBe(reply);
    await send({
      token: chat.leaderToken,
      conversationId: chat.conversationId,
      body: "too late",
      replyToId: quoted,
    }).expect(400);
  });

  it("takes concurrent messages in one conversation", async () => {
    const chat = await createChat();

    const responses = await Promise.all(
      [
        chat.leaderToken,
        chat.memberToken,
        chat.leaderToken,
        chat.memberToken,
      ].map((token, index) =>
        send({ token, conversationId: chat.conversationId, body: `${index}` }),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      201, 201, 201, 201,
    ]);
  });

  it("joins an invited participant who sends a message", async () => {
    const chat = await createChat();
    const participantRepo = ctx.dataSource.getRepository(Participant);
    const where = {
      conversation: { id: chat.conversationId },
      user: { id: chat.member.id },
    };
    await participantRepo.update(
      (await participantRepo.findOneByOrFail(where)).id,
      { state: ParticipantState.Invited, joinedAt: new Date(0) },
    );

    await sent({
      token: chat.memberToken,
      conversationId: chat.conversationId,
      body: "accepting",
    });

    const participant = await participantRepo.findOneByOrFail(where);
    expect(participant.state).toBe(ParticipantState.Joined);
    expect(participant.joinedAt.getTime()).toBeGreaterThan(0);
  });

  it("keeps already-read messages read when the last-read one is hidden", async () => {
    const chat = await createChat();
    const memberSays = (body: string) =>
      sent({
        token: chat.memberToken,
        conversationId: chat.conversationId,
        body,
      });
    await memberSays("first");
    const lastRead = await memberSays("second");
    await request(server())
      .post(`/messaging/conversations/${chat.conversationId}/read`)
      .set("Authorization", `Bearer ${chat.leaderToken}`)
      .expect(201);
    await memberSays("third");

    await hide(lastRead);

    expect(await unreadSummary(chat.leaderToken)).toBe(1);
    expect(await unreadCount(chat.leaderToken)).toBe(1);
    const listed = await listing(chat.leaderToken);
    expect(listed).toMatchObject({ unreadCount: 1, hasUnread: true });
    for (const participant of listed.participants) {
      expect(participant).not.toHaveProperty("lastReadMessageId");
    }

    const unread = await messageRepo.findOneByOrFail({ body: "third" });
    await hide(unread.id);

    expect(await unreadSummary(chat.leaderToken)).toBe(0);
    expect(await unreadCount(chat.leaderToken)).toBe(0);
    expect(await listing(chat.leaderToken)).toMatchObject({
      unreadCount: 0,
      hasUnread: false,
    });
    expect(
      (
        await request(server())
          .get(`/messaging/conversations/community/${chat.communityId}`)
          .set("Authorization", `Bearer ${chat.leaderToken}`)
          .expect(200)
      ).body,
    ).toMatchObject({ unreadCount: 0, hasUnread: false });
  });

  it("leaves hidden messages out of the admin conversation list", async () => {
    const chat = await createChat();
    const shown = await sent({
      token: chat.memberToken,
      conversationId: chat.conversationId,
      body: "shown",
    });
    const hidden = await sent({
      token: chat.memberToken,
      conversationId: chat.conversationId,
      body: "hidden",
    });

    await hide(hidden);

    const summaries: ConversationAdminSummaryDto[] = (
      await request(server())
        .get("/messaging/conversations/admin")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200)
    ).body;
    expect(
      summaries.find((summary) => summary.id === chat.conversationId),
    ).toMatchObject({ messageCount: 1, lastMessage: { id: shown } });
  });

  it("refuses to start a conversation with an account deleted meanwhile", async () => {
    const [initiator, target] = await Promise.all(
      [0, 1].map(() =>
        userRepo.save(
          userRepo.create({
            name: `Chat Member ${users}`,
            email: `messaging-soft-delete-${users++}@example.com`,
            password: "password",
          }),
        ),
      ),
    );
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await deletion.manager.delete(User, [target.id]);
      const started = ctx.app
        .get(ConversationService)
        .createDirectConversation(initiator.id, { targetUserId: target.id });
      const outcome = started.then(
        () => "started",
        (error: unknown) => error,
      );
      await waitForLockWait(ctx.dataSource);
      await deletion.commitTransaction();
      expect(await outcome).toBeInstanceOf(NotFoundException);
    } finally {
      await deletion.release();
    }

    expect(
      await ctx.dataSource
        .getRepository(Participant)
        .countBy({ user: { id: initiator.id } }),
    ).toBe(0);
  });

  it("refuses a message from an account deleted while it sends", async () => {
    const chat = await createChat();
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await deletion.manager.delete(User, [chat.member.id]);
      const sending = send({
        token: chat.memberToken,
        conversationId: chat.conversationId,
        body: "raced",
      }).then((res) => res.status);
      await waitForLockWait(ctx.dataSource);
      await deletion.commitTransaction();
      expect(await sending).toBe(403);
    } finally {
      await deletion.release();
    }

    expect(await messageRepo.countBy({ body: "raced" })).toBe(0);
  });

  it("refuses to accept an invite withdrawn while it accepts", async () => {
    const [initiator, invitee] = await Promise.all(
      [0, 1].map(() =>
        userRepo.save(
          userRepo.create({
            name: `Chat Member ${users}`,
            email: `messaging-soft-delete-${users++}@example.com`,
            password: "password",
          }),
        ),
      ),
    );
    const { id: conversationId } = await ctx.app
      .get(ConversationService)
      .createDirectConversation(initiator.id, { targetUserId: invitee.id });
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await deletion.manager.delete(Participant, {
        conversation: { id: conversationId },
        user: { id: invitee.id },
      });
      const accepting = request(server())
        .post(`/messaging/conversations/${conversationId}/accept`)
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, invitee)}`,
        )
        .then((res) => res.status);
      await waitForLockWait(ctx.dataSource);
      await deletion.commitTransaction();
      expect(await accepting).toBe(403);
    } finally {
      await deletion.release();
    }
  });

  it("refuses a reply to a message whose author is deleted while it sends", async () => {
    const chat = await createChat();
    const quoted = await sent({
      token: chat.leaderToken,
      conversationId: chat.conversationId,
      body: "quoted",
    });
    await request(server())
      .post(`/messaging/conversations/${chat.conversationId}/read`)
      .set("Authorization", `Bearer ${chat.memberToken}`)
      .expect(201);
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      // The lock an account deletion's cascade takes on its messages.
      await deletion.query(`SELECT 1 FROM message WHERE id = $1 FOR UPDATE`, [
        quoted,
      ]);
      const replying = send({
        token: chat.memberToken,
        conversationId: chat.conversationId,
        body: "raced",
        replyToId: quoted,
      }).then((res) => res.status);
      await waitForLockWait(ctx.dataSource);
      await deletion.manager.delete(User, [chat.leader.id]);
      await deletion.commitTransaction();
      expect(await replying).toBe(400);
    } finally {
      await deletion.release();
    }

    expect(await userRepo.existsBy({ id: chat.leader.id })).toBe(false);
  });
});
