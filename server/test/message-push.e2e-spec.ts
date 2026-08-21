import { Expo } from "expo-server-sdk";
import { MessagingModule } from "src/messaging/messaging.module";
import { Push } from "src/push/push.entity";
import { EXPO_CLIENT } from "src/push/push.service";
import { UserDevice } from "src/user/entities/user-device.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Message Push Notifications (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let deviceRepo: Repository<UserDevice>;
  let pushRepo: Repository<Push>;
  let mockSendPush: jest.Mock;
  let userCounter = 0;

  const createUserAndToken = async (
    overrides: Partial<User> = {},
  ): Promise<{ user: User; token: string }> => {
    userCounter += 1;
    const user = userRepo.create({
      name: `Push User ${userCounter}`,
      email: `pushuser${userCounter}@example.com`,
      password: "pass",
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

  const createUserWithDevice = async (
    overrides: Partial<User> = {},
  ): Promise<{ user: User; token: string; expoPushToken: string }> => {
    const { user, token } = await createUserAndToken(overrides);
    const expoPushToken = `ExponentPushToken[test_${user.id}_${Date.now()}]`;
    await deviceRepo.save(
      deviceRepo.create({
        user,
        deviceType: "iOS",
        expoPushToken,
      }),
    );
    return { user, token, expoPushToken };
  };

  /** Send a message and wait briefly for the async EventEmitter listener. */
  const sendMessage = async (
    senderToken: string,
    conversationId: number,
    body: string,
  ) => {
    const res = await request(ctx.app.getHttpServer())
      .post("/messaging/messages")
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ conversationId, body })
      .expect(201);
    // Give the async event listener time to process
    await new Promise((resolve) => setTimeout(resolve, 200));
    return res;
  };

  const createDirectConversation = async (
    initiatorToken: string,
    targetUserId: number,
  ): Promise<number> => {
    const res = await request(ctx.app.getHttpServer())
      .post("/messaging/conversations/direct")
      .set("Authorization", `Bearer ${initiatorToken}`)
      .send({ targetUserId })
      .expect(201);
    return res.body.id;
  };

  const createGroupConversation = async (
    ownerToken: string,
    title: string,
    participantIds: number[],
  ): Promise<number> => {
    const res = await request(ctx.app.getHttpServer())
      .post("/messaging/conversations/group")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title, participantIds })
      .expect(201);
    return res.body.id;
  };

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    userRepo = ctx.dataSource.getRepository(User);
    deviceRepo = ctx.dataSource.getRepository(UserDevice);
    pushRepo = ctx.dataSource.getRepository(Push);

    // Mock the Expo client so we never hit the real push service
    const expo = ctx.app.get<Expo>(EXPO_CLIENT);
    mockSendPush = jest.fn(async (messages) =>
      messages.map(() => ({ status: "ok", id: `receipt-${Date.now()}` })),
    );
    jest
      .spyOn(expo, "chunkPushNotifications")
      .mockImplementation((msgs) => [msgs]);
    jest
      .spyOn(expo, "sendPushNotificationsAsync")
      .mockImplementation(mockSendPush);
  }, 50000);

  afterAll(async () => {
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  describe("direct conversations", () => {
    it("creates a push for the recipient when a message is sent", async () => {
      const { token: senderToken } = await createUserWithDevice();
      const { user: recipient, expoPushToken } = await createUserWithDevice();

      const conversationId = await createDirectConversation(
        senderToken,
        recipient.id,
      );

      await sendMessage(senderToken, conversationId, "Hey, are you free?");

      const pushes = await pushRepo.find({
        where: { expoPushToken },
      });
      expect(pushes).toHaveLength(1);
      expect(pushes[0].body).toContain("Hey, are you free?");
      expect(pushes[0].screen).toBe(`/messages/${conversationId}`);
      expect(pushes[0].ticketStatus).toBe("ok");
    });

    it("does not create a push for the sender", async () => {
      const { token: senderToken, expoPushToken: senderPushToken } =
        await createUserWithDevice();
      const { user: recipient } = await createUserWithDevice();

      const conversationId = await createDirectConversation(
        senderToken,
        recipient.id,
      );

      await sendMessage(senderToken, conversationId, "Hello");

      const senderPushes = await pushRepo.find({
        where: { expoPushToken: senderPushToken },
      });
      expect(senderPushes).toHaveLength(0);
    });
  });

  describe("user preferences", () => {
    it("does not push when pushesForMessages is false", async () => {
      const { token: senderToken } = await createUserWithDevice();
      const { user: recipient, expoPushToken } = await createUserWithDevice({
        pushesForMessages: false,
      });

      const conversationId = await createDirectConversation(
        senderToken,
        recipient.id,
      );

      await sendMessage(senderToken, conversationId, "Will you see this?");

      const pushes = await pushRepo.find({
        where: { expoPushToken },
      });
      expect(pushes).toHaveLength(0);
    });

    it("does not push when turnedOffAllNotifs is true", async () => {
      const { token: senderToken } = await createUserWithDevice();
      const { user: recipient, expoPushToken } = await createUserWithDevice({
        turnedOffAllNotifs: true,
      });

      const conversationId = await createDirectConversation(
        senderToken,
        recipient.id,
      );

      await sendMessage(senderToken, conversationId, "No notifs please");

      const pushes = await pushRepo.find({
        where: { expoPushToken },
      });
      expect(pushes).toHaveLength(0);
    });
  });

  describe("group conversations", () => {
    it("sends pushes to all non-sender participants with group format", async () => {
      const { token: ownerToken } = await createUserWithDevice();
      const { user: memberA, expoPushToken: tokenA } =
        await createUserWithDevice();
      const { user: memberB, expoPushToken: tokenB } =
        await createUserWithDevice();

      const conversationId = await createGroupConversation(
        ownerToken,
        "Project Team",
        [memberA.id, memberB.id],
      );

      // Members need to accept
      const memberAToken = ctx.jwtService.sign(
        { sub: memberA.id, email: memberA.email, name: memberA.name },
        { secret: process.env.JWT_SECRET },
      );
      const memberBToken = ctx.jwtService.sign(
        { sub: memberB.id, email: memberB.email, name: memberB.name },
        { secret: process.env.JWT_SECRET },
      );
      await request(ctx.app.getHttpServer())
        .post(`/messaging/conversations/${conversationId}/accept`)
        .set("Authorization", `Bearer ${memberAToken}`)
        .expect(201);
      await request(ctx.app.getHttpServer())
        .post(`/messaging/conversations/${conversationId}/accept`)
        .set("Authorization", `Bearer ${memberBToken}`)
        .expect(201);

      await sendMessage(ownerToken, conversationId, "Hey everyone");

      const pushesA = await pushRepo.find({ where: { expoPushToken: tokenA } });
      const pushesB = await pushRepo.find({ where: { expoPushToken: tokenB } });

      expect(pushesA).toHaveLength(1);
      expect(pushesB).toHaveLength(1);

      // Group format: "SenderName in GroupTitle: message"
      expect(pushesA[0].body).toContain("in Project Team");
      expect(pushesA[0].body).toContain("Hey everyone");
      expect(pushesB[0].body).toContain("in Project Team");
    });
  });

  describe("idempotency", () => {
    it("prevents duplicate pushes for the same message via idempotency key", async () => {
      const { token: senderToken } = await createUserWithDevice();
      const { user: recipient, expoPushToken } = await createUserWithDevice();

      const conversationId = await createDirectConversation(
        senderToken,
        recipient.id,
      );

      const msgRes = await sendMessage(
        senderToken,
        conversationId,
        "Unique message",
      );

      const pushes = await pushRepo.find({
        where: { expoPushToken },
      });
      expect(pushes).toHaveLength(1);
      expect(pushes[0].idempotencyKey).toContain(`msg-${msgRes.body.id}`);
    });
  });

  describe("multiple devices", () => {
    it("sends a push to each of the recipient devices", async () => {
      const { token: senderToken } = await createUserWithDevice();
      const { user: recipient } = await createUserAndToken();

      const token1 = `ExponentPushToken[device1_${recipient.id}]`;
      const token2 = `ExponentPushToken[device2_${recipient.id}]`;
      await deviceRepo.save([
        deviceRepo.create({
          user: recipient,
          deviceType: "iOS",
          expoPushToken: token1,
        }),
        deviceRepo.create({
          user: recipient,
          deviceType: "Android",
          expoPushToken: token2,
        }),
      ]);

      const conversationId = await createDirectConversation(
        senderToken,
        recipient.id,
      );

      await sendMessage(senderToken, conversationId, "Multi-device test");

      const pushes1 = await pushRepo.find({
        where: { expoPushToken: token1 },
      });
      const pushes2 = await pushRepo.find({
        where: { expoPushToken: token2 },
      });
      expect(pushes1).toHaveLength(1);
      expect(pushes2).toHaveLength(1);
    });
  });
});
