import { ConversationType } from "@alliance/common/conversationType";
import { ParticipantRole } from "@alliance/common/participantRole";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Community } from "src/community/entities/community.entity";
import { ImagesService } from "src/images/images.service";
import { ConversationService } from "src/messaging/conversation.service";
import { Conversation } from "src/messaging/entities/conversation.entity";
import { Message } from "src/messaging/entities/message.entity";
import {
  Participant,
  ParticipantState,
} from "src/messaging/entities/participant.entity";
import { Notification } from "src/notifs/entities/notification.entity";
import { LikeNotificationService } from "src/notifs/like-notification.service";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import {
  createTestApp,
  TestContext,
  writeDuringDeletion,
} from "./e2e-test-utils";

describe("Chat updates to a row deleted after its load (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let emails = 0;

  const member = (overrides: Partial<User> = {}) =>
    userRepo.save(
      userRepo.create({
        name: "Writer Member",
        email: `writer-${emails++}@example.com`,
        password: "password",
        ...overrides,
      }),
    );

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("leaves a group chat deleted while its info is edited", async () => {
    const admin = await member();
    const conversations = ctx.dataSource.getRepository(Conversation);
    const conversation = await conversations.save({
      type: ConversationType.Multiple,
      title: "Before",
    });
    await ctx.dataSource.getRepository(Participant).save({
      conversation,
      user: admin,
      role: ParticipantRole.Admin,
      state: ParticipantState.Joined,
      joinedAt: new Date(),
    });
    jest
      .spyOn(ctx.app.get(ImagesService), "processAndUploadProfileImage")
      .mockImplementationOnce(async () => {
        await conversations.softDelete(conversation.id);
        return "chat-photo-key";
      });

    await expect(
      ctx.app
        .get(ConversationService)
        .updateConversation(conversation.id, admin.id, {
          title: "After",
          photo: "data:image/png;base64,AAAA",
        }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await conversations.findOneOrFail({
        where: { id: conversation.id },
        withDeleted: true,
      }),
    ).toMatchObject({ title: "Before", deletedAt: expect.any(Date) });
  });

  it("adds a like to a fresh notification when the unread one goes mid-like", async () => {
    const [owner, first, second] = await Promise.all([
      member(),
      member(),
      member(),
    ]);
    const likes = ctx.app.get(LikeNotificationService);
    const like = (liker: User) =>
      likes.createOrUpdate({
        owner,
        liker,
        targetType: "post",
        targetId: owner.id,
        webAppLocation: "/forum",
        targetContent: "Liked post",
      });
    await like(first);
    const notifs = ctx.dataSource.getRepository(Notification);
    const original = await notifs.findOneByOrFail({ user: { id: owner.id } });

    await writeDuringDeletion({
      dataSource: ctx.dataSource,
      target: Notification,
      id: original.id,
      write: () => like(second),
    });

    expect(
      await notifs.find({
        where: { user: { id: owner.id } },
        relations: { associatedUsers: true },
        withDeleted: true,
        order: { id: "ASC" },
      }),
    ).toMatchObject([
      { id: original.id, deletedAt: expect.any(Date) },
      { deletedAt: null, associatedUsers: [{ id: second.id }] },
    ]);
  });

  describe("a chat participant deleted after a write loads it", () => {
    const setUp = async () => {
      const [leader, invitee] = await Promise.all([member(), member()]);
      const community = await ctx.dataSource.getRepository(Community).save({
        name: "Chatting group",
        description: "Chatting",
        leaders: [leader],
        users: [leader, invitee],
      });
      const conversations = ctx.app.get(ConversationService);
      const conversation = await conversations.syncCommunityConversationMembers(
        community.id,
      );
      await ctx.dataSource
        .getRepository(Message)
        .save({ body: "Hello", author: leader, conversation });
      const participants = ctx.dataSource.getRepository(Participant);
      const participant = await participants.findOneByOrFail({
        conversation: { id: conversation.id },
        user: { id: invitee.id },
      });
      await participants.update(participant.id, {
        state: ParticipantState.Invited,
      });
      const stored = () =>
        participants.findOneOrFail({
          where: { id: participant.id },
          withDeleted: true,
        });
      return {
        conversations,
        community,
        conversationId: conversation.id,
        invitee,
        deleteParticipant: () => participants.softDelete(participant.id),
        stored,
      };
    };

    const unchanged = {
      state: ParticipantState.Invited,
      lastReadMessageId: null,
      deletedAt: expect.any(Date),
    };

    it.each([
      ["accepting its invite", "acceptInvite"],
      ["marking the chat read", "markConversationRead"],
    ] as const)("stays deleted through %s", async (_, write) => {
      const {
        conversations,
        conversationId,
        invitee,
        deleteParticipant,
        stored,
      } = await setUp();
      const load = conversations.getParticipantOrFail.bind(conversations);
      jest
        .spyOn(conversations, "getParticipantOrFail")
        .mockImplementationOnce(async (lookup) => {
          const loaded = await load(lookup);
          await deleteParticipant();
          return loaded;
        });

      await expect(
        conversations[write](conversationId, invitee.id),
      ).rejects.toThrow(ForbiddenException);
      expect(await stored()).toMatchObject(unchanged);
    });

    it("stays deleted through a membership sync that rejoins the member", async () => {
      const {
        conversations,
        community,
        conversationId,
        invitee,
        deleteParticipant,
        stored,
      } = await setUp();
      const repo = ctx.app.get<Repository<Conversation>>(
        getRepositoryToken(Conversation),
      );
      const load = repo.findOneOrFail.bind(repo);
      jest
        .spyOn(repo, "findOneOrFail")
        .mockImplementationOnce(async (options) => {
          const loaded = await load(options);
          await deleteParticipant();
          return loaded;
        });

      await conversations.syncCommunityConversationMembers(community.id);

      expect(await stored()).toMatchObject(unchanged);
      expect(
        await ctx.dataSource.getRepository(Participant).findBy({
          conversation: { id: conversationId },
          user: { id: invitee.id },
        }),
      ).toMatchObject([{ state: ParticipantState.Joined }]);
    });

    it("stays deleted through a move that rejoins the member", async () => {
      const {
        conversations,
        community,
        conversationId,
        invitee,
        deleteParticipant,
        stored,
      } = await setUp();
      const manager = ctx.dataSource.manager;
      const repo = manager.getRepository(Participant);
      const load = repo.findOne.bind(repo);
      jest.spyOn(repo, "findOne").mockImplementationOnce(async (options) => {
        const loaded = await load(options);
        await deleteParticipant();
        return loaded;
      });

      await conversations.placeCommunityConversationParticipant({
        manager,
        user: invitee,
        sourceCommunity: null,
        destinationCommunity: community,
      });

      expect(await stored()).toMatchObject(unchanged);
      expect(
        await ctx.dataSource.getRepository(Participant).findBy({
          conversation: { id: conversationId },
          user: { id: invitee.id },
        }),
      ).toMatchObject([{ state: ParticipantState.Joined }]);
    });
  });
});
