import request from 'supertest';
import { Repository } from 'typeorm';
import { MessagingModule } from 'src/messaging/messaging.module';
import {
  Conversation,
  ConversationType,
} from 'src/messaging/entities/conversation.entity';
import {
  Participant,
  ParticipantRole,
  ParticipantState,
} from 'src/messaging/entities/participant.entity';
import { User } from 'src/user/entities/user.entity';
import { createTestApp, TestContext } from './e2e-test-utils';

describe('ConversationController (e2e)', () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let conversationRepo: Repository<Conversation>;
  let participantRepo: Repository<Participant>;
  let userCounter = 0;

  const createUserAndToken = async (
    overrides: Partial<User> = {},
  ): Promise<{ user: User; token: string }> => {
    userCounter += 1;
    const user = userRepo.create({
      name: `Extra User ${userCounter}`,
      email: `extra${userCounter}@example.com`,
      password: 'pass',
      tags: [ctx.defaultTag],
      ...overrides,
    });
    await userRepo.save(user);
    const token = ctx.jwtService.sign(
      { sub: user.id, email: user.email, name: user.name },
      { secret: process.env.JWT_SECRET },
    );
    return { user, token };
  };

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    userRepo = ctx.dataSource.getRepository(User);
    conversationRepo = ctx.dataSource.getRepository(Conversation);
    participantRepo = ctx.dataSource.getRepository(Participant);
  }, 50000);

  afterAll(async () => {
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  describe('direct conversations', () => {
    it('creates a direct conversation and surfaces the invite state to the target user', async () => {
      const { user: targetUser, token: targetToken } =
        await createUserAndToken();

      const createResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          targetUserId: targetUser.id,
          title: 'Hello there',
        })
        .expect(201);

      expect(createResponse.body.type).toBe(ConversationType.Direct);
      expect(createResponse.body.participants).toHaveLength(2);

      const initiatorParticipant = createResponse.body.participants.find(
        (participant) => participant.user.id === ctx.testUserId,
      );
      const invitedParticipant = createResponse.body.participants.find(
        (participant) => participant.user.id === targetUser.id,
      );

      expect(initiatorParticipant?.state).toBe(ParticipantState.Joined);
      expect(invitedParticipant?.state).toBe(ParticipantState.Invited);

      const targetListResponse = await request(ctx.app.getHttpServer())
        .get('/messaging/conversations')
        .set('Authorization', `Bearer ${targetToken}`)
        .expect(200);

      const targetConversation = targetListResponse.body.find(
        (conversation) => conversation.id === createResponse.body.id,
      );

      expect(targetConversation).toBeDefined();
      expect(targetConversation.isMessageRequest).toBe(true);
      expect(
        targetConversation?.participants.find(
          (participant) => participant.user.id === targetUser.id,
        )?.state,
      ).toBe(ParticipantState.Invited);
    });

    it('reuses an existing direct conversation instead of creating duplicates', async () => {
      const { user: targetUser, token: targetToken } =
        await createUserAndToken();

      const firstResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ targetUserId: targetUser.id })
        .expect(201);

      const secondResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ targetUserId: targetUser.id })
        .expect(201);

      expect(secondResponse.body.id).toBe(firstResponse.body.id);

      const reverseResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${targetToken}`)
        .send({ targetUserId: ctx.testUserId })
        .expect(201);

      expect(reverseResponse.body.id).toBe(firstResponse.body.id);
    });

    it('rejects invalid direct conversation requests', async () => {
      const selfResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ targetUserId: ctx.testUserId })
        .expect(400);

      expect(selfResponse.body.message).toContain(
        'You cannot message yourself.',
      );

      await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ targetUserId: 999999 })
        .expect(404);
    });

    it('removes a direct conversation when the invite is declined', async () => {
      const { user: targetUser, token: targetToken } =
        await createUserAndToken();

      const createResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ targetUserId: targetUser.id })
        .expect(201);

      const conversationId = createResponse.body.id;

      const declineResponse = await request(ctx.app.getHttpServer())
        .post(`/messaging/conversations/${conversationId}/decline`)
        .set('Authorization', `Bearer ${targetToken}`)
        .expect(201);

      expect(declineResponse.body.type).toBe(ConversationType.Direct);
      expect(
        declineResponse.body.participants.map(
          (participant) => participant.user.id,
        ),
      ).not.toContain(targetUser.id);

      const initiatorConversations = await request(ctx.app.getHttpServer())
        .get('/messaging/conversations')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(
        initiatorConversations.body.find(
          (conversation) => conversation.id === conversationId,
        ),
      ).toBeUndefined();

      const targetConversations = await request(ctx.app.getHttpServer())
        .get('/messaging/conversations')
        .set('Authorization', `Bearer ${targetToken}`)
        .expect(200);

      expect(
        targetConversations.body.find(
          (conversation) => conversation.id === conversationId,
        ),
      ).toBeUndefined();

      const storedConversation = await conversationRepo.findOne({
        where: { id: conversationId },
      });
      expect(storedConversation).toBeNull();
    });
  });

  describe('group conversations', () => {
    it('requires at least one additional participant', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/group')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Solo Group',
          participantIds: [ctx.testUserId],
        })
        .expect(400);

      expect(response.body.message).toContain(
        'A group conversation requires at least one additional participant.',
      );
    });

    it('throws when a requested participant is missing', async () => {
      await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/group')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Missing Participant',
          participantIds: [999999],
        })
        .expect(404);
    });

    it('creates a group conversation, deduplicates participants, and reuses the existing room', async () => {
      const { user: memberA } = await createUserAndToken();
      const { user: memberB } = await createUserAndToken();

      const createResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/group')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Project Chat',
          participantIds: [memberA.id, memberB.id, memberB.id],
        })
        .expect(201);

      expect(createResponse.body.type).toBe(ConversationType.Multiple);

      expect(createResponse.body.participants).toHaveLength(3);
      const owner = createResponse.body.participants.find(
        (participant) => participant.user.id === ctx.testUserId,
      );
      expect(owner?.role).toBe(ParticipantRole.Owner);
      expect(owner?.state).toBe(ParticipantState.Joined);

      const repeatResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/group')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Project Chat',
          participantIds: [memberB.id, memberA.id],
        })
        .expect(201);

      expect(repeatResponse.body.id).toBe(createResponse.body.id);
      expect(repeatResponse.body.participants).toHaveLength(3);
    });

    it('allows invited participants to accept and blocks outsiders', async () => {
      const { user: invitedUser, token: invitedToken } =
        await createUserAndToken();
      const { token: outsiderToken } = await createUserAndToken();

      const createResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/group')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Joinable Chat',
          participantIds: [invitedUser.id],
        })
        .expect(201);

      const conversationId = createResponse.body.id;

      const invitePreview = await request(ctx.app.getHttpServer())
        .get('/messaging/conversations')
        .set('Authorization', `Bearer ${invitedToken}`)
        .expect(200);

      const pendingConversation = invitePreview.body.find(
        (conversation) => conversation.id === conversationId,
      );
      expect(pendingConversation?.isMessageRequest).toBe(true);

      const acceptResponse = await request(ctx.app.getHttpServer())
        .post(`/messaging/conversations/${conversationId}/accept`)
        .set('Authorization', `Bearer ${invitedToken}`)
        .expect(201);

      const acceptedParticipant = acceptResponse.body.participants.find(
        (participant) => participant.user.id === invitedUser.id,
      );
      expect(acceptedParticipant?.state).toBe(ParticipantState.Joined);
      expect(acceptResponse.body.isMessageRequest).toBe(false);

      await request(ctx.app.getHttpServer())
        .post(`/messaging/conversations/${conversationId}/accept`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('removes members who leave and blocks further access attempts', async () => {
      const { user: leavingUser, token: leavingToken } =
        await createUserAndToken();

      const createResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/group')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Temporary Chat',
          participantIds: [leavingUser.id],
        })
        .expect(201);

      const conversationId = createResponse.body.id;

      await request(ctx.app.getHttpServer())
        .post(`/messaging/conversations/${conversationId}/accept`)
        .set('Authorization', `Bearer ${leavingToken}`)
        .expect(201);

      const leaveResponse = await request(ctx.app.getHttpServer())
        .post(`/messaging/conversations/${conversationId}/leave`)
        .set('Authorization', `Bearer ${leavingToken}`)
        .expect(201);

      expect(
        leaveResponse.body.participants.map(
          (participant) => participant.user.id,
        ),
      ).not.toContain(leavingUser.id);

      await request(ctx.app.getHttpServer())
        .post(`/messaging/conversations/${conversationId}/leave`)
        .set('Authorization', `Bearer ${leavingToken}`)
        .expect(403);

      const { token: outsiderToken } = await createUserAndToken();
      await request(ctx.app.getHttpServer())
        .post(`/messaging/conversations/${conversationId}/leave`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);

      const participantRecords = await participantRepo.find({
        where: {
          conversation: { id: conversationId },
          user: { id: leavingUser.id },
        },
      });
      expect(participantRecords).toHaveLength(0);
    });
  });

  describe('unread counts', () => {
    const getUnreadCount = async (token: string): Promise<number> => {
      const response = await request(ctx.app.getHttpServer())
        .get('/messaging/conversations/unread')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      return response.body.count;
    };

    const createDirectConversationWithUnread = async (
      readerToken: string,
      senderId: number,
      senderToken: string,
    ): Promise<number> => {
      const conversationResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ targetUserId: senderId })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/messaging/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          conversationId: conversationResponse.body.id,
          body: 'Unread message for total count checks',
        })
        .expect(201);

      return conversationResponse.body.id;
    };

    it('returns zero when the user has no conversations or unread messages', async () => {
      const { token } = await createUserAndToken();
      const unreadCount = await getUnreadCount(token);
      expect(unreadCount).toBe(0);
    });

    it('ignores messages authored by the requesting user', async () => {
      const { token: readerToken } = await createUserAndToken();
      const { user: recipient } = await createUserAndToken();

      const conversationResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ targetUserId: recipient.id })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/messaging/messages')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          conversationId: conversationResponse.body.id,
          body: 'Hello, me!',
        })
        .expect(201);

      const unreadCount = await getUnreadCount(readerToken);
      expect(unreadCount).toBe(0);
    });

    it('counts conversations with unread messages from others and clears after marking read', async () => {
      const { token: readerToken } = await createUserAndToken();
      const { user: sender, token: senderToken } = await createUserAndToken();

      const conversationResponse = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ targetUserId: sender.id })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/messaging/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          conversationId: conversationResponse.body.id,
          body: 'Unread for you',
        })
        .expect(201);

      const unreadBefore = await getUnreadCount(readerToken);
      expect(unreadBefore).toBe(1);

      await request(ctx.app.getHttpServer())
        .post(`/messaging/conversations/${conversationResponse.body.id}/read`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(201);

      const unreadAfter = await getUnreadCount(readerToken);
      expect(unreadAfter).toBe(0);
    });

    it('counts distinct conversations even when multiple messages are unread', async () => {
      const { token: readerToken } = await createUserAndToken();
      const { user: senderA, token: senderAToken } = await createUserAndToken();
      const { user: senderB, token: senderBToken } = await createUserAndToken();

      const conversationA = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ targetUserId: senderA.id })
        .expect(201);

      const conversationB = await request(ctx.app.getHttpServer())
        .post('/messaging/conversations/direct')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ targetUserId: senderB.id })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/messaging/messages')
        .set('Authorization', `Bearer ${senderAToken}`)
        .send({ conversationId: conversationA.body.id, body: 'Hi from A' })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/messaging/messages')
        .set('Authorization', `Bearer ${senderAToken}`)
        .send({
          conversationId: conversationA.body.id,
          body: 'Another from A',
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/messaging/messages')
        .set('Authorization', `Bearer ${senderBToken}`)
        .send({ conversationId: conversationB.body.id, body: 'Hi from B' })
        .expect(201);

      const unreadCount = await getUnreadCount(readerToken);
      expect(unreadCount).toBe(2);
    });

    describe('overall unread totals across multiple conversations', () => {
      it('adjusts totals when conversations are toggled read and new messages arrive across threads', async () => {
        const { token: readerToken } = await createUserAndToken();
        const { user: senderA, token: senderAToken } = await createUserAndToken();
        const { user: senderB, token: senderBToken } = await createUserAndToken();
        const { user: senderC, token: senderCToken } = await createUserAndToken();

        const conversationAId = await createDirectConversationWithUnread(
          readerToken,
          senderA.id,
          senderAToken,
        );
        const conversationBId = await createDirectConversationWithUnread(
          readerToken,
          senderB.id,
          senderBToken,
        );
        const conversationCId = await createDirectConversationWithUnread(
          readerToken,
          senderC.id,
          senderCToken,
        );

        await request(ctx.app.getHttpServer())
          .post('/messaging/messages')
          .set('Authorization', `Bearer ${senderBToken}`)
          .send({
            conversationId: conversationBId,
            body: 'Another unread from B',
          })
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(3);

        await request(ctx.app.getHttpServer())
          .post(`/messaging/conversations/${conversationAId}/read`)
          .set('Authorization', `Bearer ${readerToken}`)
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(2);

        await request(ctx.app.getHttpServer())
          .post('/messaging/messages')
          .set('Authorization', `Bearer ${senderAToken}`)
          .send({
            conversationId: conversationAId,
            body: 'New activity after read',
          })
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(3);

        await request(ctx.app.getHttpServer())
          .post(`/messaging/conversations/${conversationBId}/read`)
          .set('Authorization', `Bearer ${readerToken}`)
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(2);

        await request(ctx.app.getHttpServer())
          .post(`/messaging/conversations/${conversationAId}/read`)
          .set('Authorization', `Bearer ${readerToken}`)
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(1);

        await request(ctx.app.getHttpServer())
          .post(`/messaging/conversations/${conversationCId}/read`)
          .set('Authorization', `Bearer ${readerToken}`)
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(0);
      });

      it('handles re-reading threads and new activity after clearing all unreads', async () => {
        const { token: readerToken } = await createUserAndToken();
        const { user: senderA, token: senderAToken } = await createUserAndToken();
        const { user: senderB, token: senderBToken } = await createUserAndToken();

        const conversationAId = await createDirectConversationWithUnread(
          readerToken,
          senderA.id,
          senderAToken,
        );
        const conversationBId = await createDirectConversationWithUnread(
          readerToken,
          senderB.id,
          senderBToken,
        );

        expect(await getUnreadCount(readerToken)).toBe(2);

        await request(ctx.app.getHttpServer())
          .post(`/messaging/conversations/${conversationAId}/read`)
          .set('Authorization', `Bearer ${readerToken}`)
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(1);

        await request(ctx.app.getHttpServer())
          .post(`/messaging/conversations/${conversationAId}/read`)
          .set('Authorization', `Bearer ${readerToken}`)
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(1);

        await request(ctx.app.getHttpServer())
          .post(`/messaging/conversations/${conversationBId}/read`)
          .set('Authorization', `Bearer ${readerToken}`)
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(0);

        await request(ctx.app.getHttpServer())
          .post('/messaging/messages')
          .set('Authorization', `Bearer ${senderBToken}`)
          .send({
            conversationId: conversationBId,
            body: 'Fresh unread message',
          })
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(1);

        await request(ctx.app.getHttpServer())
          .post(`/messaging/conversations/${conversationAId}/read`)
          .set('Authorization', `Bearer ${readerToken}`)
          .expect(201);

        expect(await getUnreadCount(readerToken)).toBe(1);
      });
    });
  });
});
