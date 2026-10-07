import { milliseconds } from "date-fns";
import { Expo } from "expo-server-sdk";
import { ActionCohortDecision } from "src/actions/entities/action-cohort-decision.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { CohortDecisionReason } from "src/actions/entities/cohort-decision-reason";
import { SingleMemberCohortService } from "src/actions/single-member-cohort.service";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import { Post } from "src/forum/entities/post.entity";
import { MessagingModule } from "src/messaging/messaging.module";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { LikeNotificationService } from "src/notifs/like-notification.service";
import {
  action,
  member,
  NotificationFormat,
  notifMessage,
  userDestination,
} from "src/notifs/notification-content";
import { NotifsService } from "src/notifs/notifs.service";
import { NotifPushDispatcherWorker } from "src/push/notif-push-dispatcher.worker";
import { Push } from "src/push/push.entity";
import { EXPO_CLIENT, PushService } from "src/push/push.service";
import { UserDevice } from "src/user/entities/user-device.entity";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("NotifPushDispatcher – new device filtering (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let deviceRepo: Repository<UserDevice>;
  let pushRepo: Repository<Push>;
  let notifRepo: Repository<Notification>;
  let unreadContentRepo: Repository<UnreadContent>;
  let pushService: PushService;
  let dispatcher: NotifPushDispatcherWorker;
  let mockSendPush: jest.Mock;
  let userCounter = 0;

  const createUser = async (overrides: Partial<User> = {}): Promise<User> => {
    userCounter += 1;
    const user = userRepo.create({
      name: `Dispatcher User ${userCounter}`,
      email: `dispatcheruser${userCounter}@example.com`,
      password: "pass",
      tags: [ctx.defaultTag],
      ...overrides,
    });
    return userRepo.save(user);
  };

  const createDevice = async (
    user: User,
    createdAt?: Date,
  ): Promise<UserDevice> => {
    const token = `ExponentPushToken[dispatch_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2)}]`;
    const device = deviceRepo.create({
      user,
      deviceType: "iOS",
      expoPushToken: token,
    });
    const saved = await deviceRepo.save(device);
    if (createdAt) {
      await deviceRepo.query(
        `UPDATE user_device SET "createdAt" = $1 WHERE id = $2`,
        [createdAt, saved.id],
      );
      saved.createdAt = createdAt;
    }
    return saved;
  };

  const createNotification = async (
    user: User,
    sendTime: Date,
    overrides: Partial<Notification> = {},
  ): Promise<Notification> => {
    const notif = notifRepo.create({
      format: NotificationFormat.Legacy,
      user,
      message: "Test push notification",
      category: NotificationCategory.ActionEvent,
      webAppLocation: "/test",
      mobileAppLocation: "/test",
      shouldPush: true,
      sendTime,
      ...overrides,
    });
    return notifRepo.save(notif);
  };

  const createActionReply = async (params: {
    action: Action;
    author: User;
    body: string;
  }): Promise<Comment> => {
    const editableContent = await ctx.dataSource
      .getRepository(EditableContent)
      .save({ body: params.body, attachments: [] });
    return ctx.dataSource.getRepository(Comment).save({
      author: params.author,
      authorId: params.author.id,
      editableContent,
      parentObjectType: CommentParentObject.Action,
      parentObjectId: params.action.id,
      deletedAt: null,
      pinned: false,
      likesCount: 0,
    });
  };

  const createForumReplyUnreadContent = async (
    user: User,
    sendTime: Date,
    readAt: Date,
  ): Promise<UnreadContent> => {
    const editableContent = await ctx.dataSource
      .getRepository(EditableContent)
      .save({ body: "Test reply body", attachments: [] });
    const comment = await ctx.dataSource.getRepository(Comment).save({
      author: user,
      authorId: user.id,
      editableContent,
      parentObjectType: CommentParentObject.Post,
      parentObjectId: 1,
      deletedAt: null,
      pinned: false,
      likesCount: 0,
    });
    return unreadContentRepo.save(
      unreadContentRepo.create({
        format: NotificationFormat.Legacy,
        user,
        contentType: UnreadContentType.ForumReply,
        contentId: comment.id,
        sendTime,
        readAt,
        shouldPush: true,
      }),
    );
  };

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    userRepo = ctx.dataSource.getRepository(User);
    deviceRepo = ctx.dataSource.getRepository(UserDevice);
    pushRepo = ctx.dataSource.getRepository(Push);
    notifRepo = ctx.dataSource.getRepository(Notification);
    unreadContentRepo = ctx.dataSource.getRepository(UnreadContent);
    pushService = ctx.app.get(PushService);
    dispatcher = ctx.app.get(NotifPushDispatcherWorker);

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

  beforeEach(async () => {
    await pushRepo.query("DELETE FROM push");
    await notifRepo.query("DELETE FROM notification");
    await unreadContentRepo.query("DELETE FROM unread_content");
    await deviceRepo.query("DELETE FROM user_device");
    mockSendPush.mockClear();
  });

  describe("getPushForAllUserDevices with notifCreatedAt filter", () => {
    it("sends to devices registered before the notification was created", async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - milliseconds({ hours: 1 }));

      // Device registered 1 hour ago
      const device = await createDevice(user, oneHourAgo);

      // Notification created now (after device)
      const messages = await pushService.getPushForAllUserDevices(
        user.id,
        {
          userId: user.id,
          body: "Test message",
          idempotencyKey: "test-1",
        },
        now,
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].expoPushToken).toBe(device.expoPushToken);
    });

    it("does not send to devices registered after the notification was created", async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - milliseconds({ hours: 1 }));

      // Device registered now
      await createDevice(user, now);

      // Notification was created 1 hour ago (before device)
      const messages = await pushService.getPushForAllUserDevices(
        user.id,
        {
          userId: user.id,
          body: "Old notification",
          idempotencyKey: "test-2",
        },
        oneHourAgo,
      );

      expect(messages).toHaveLength(0);
    });

    it("sends to old device but not new device for an old notification", async () => {
      const user = await createUser();
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - milliseconds({ hours: 2 }));
      const oneHourAgo = new Date(now.getTime() - milliseconds({ hours: 1 }));

      // Old device registered 2 hours ago
      const oldDevice = await createDevice(user, twoHoursAgo);
      // New device registered now
      await createDevice(user, now);

      // Notification created 1 hour ago (between the two device registrations)
      const messages = await pushService.getPushForAllUserDevices(
        user.id,
        {
          userId: user.id,
          body: "Mid-age notification",
          idempotencyKey: "test-3",
        },
        oneHourAgo,
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].expoPushToken).toBe(oldDevice.expoPushToken);
    });

    it("sends to all devices when notifCreatedAt is not provided", async () => {
      const user = await createUser();
      const now = new Date();

      const device1 = await createDevice(user, now);
      const device2 = await createDevice(user, now);

      const messages = await pushService.getPushForAllUserDevices(user.id, {
        userId: user.id,
        body: "No filter",
        idempotencyKey: "test-4",
      });

      expect(messages).toHaveLength(2);
      const tokens = messages.map((m) => m.expoPushToken);
      expect(tokens).toContain(device1.expoPushToken);
      expect(tokens).toContain(device2.expoPushToken);
    });
  });

  describe("dispatcher integration", () => {
    it("does not push old notifications to a newly registered device", async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - milliseconds({ hours: 1 }));

      // Notification created 1 hour ago
      await createNotification(user, oneHourAgo);

      // Device registered now (after the notification)
      await createDevice(user, now);

      // Run the dispatcher (call private method directly to bypass NODE_ENV check)
      const messages =
        await dispatcher.findNotificationPushes("test-dispatch-1");

      // No messages should be generated since the device was registered after the notification
      expect(messages).toHaveLength(0);
    });

    it("pushes notifications to devices that existed before the notification", async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - milliseconds({ hours: 1 }));
      const fiveMinutesAgo = new Date(
        now.getTime() - milliseconds({ minutes: 5 }),
      );

      // Device registered 1 hour ago
      const device = await createDevice(user, oneHourAgo);

      // Notification created 5 minutes ago (after device)
      await createNotification(user, fiveMinutesAgo);

      const messages =
        await dispatcher.findNotificationPushes("test-dispatch-2");

      expect(messages).toHaveLength(1);
      expect(messages[0].expoPushToken).toBe(device.expoPushToken);
      expect(messages[0].body).toBe("Test push notification");
    });

    it("can send a second push when a grouped like notification is updated", async () => {
      const user = await createUser({ pushesForLikes: true });
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - milliseconds({ hours: 1 }));

      await createDevice(user, oneHourAgo);

      const notif = await createNotification(user, oneHourAgo, {
        category: NotificationCategory.Likes,
        message: "First like",
      });

      const firstMessages = await dispatcher.findNotificationPushes(
        "test-dispatch-likes-1",
      );
      expect(firstMessages).toHaveLength(1);
      expect(firstMessages[0].body).toBe("First like");

      const firstPushes = await pushService.sendMessages(firstMessages);
      expect(firstPushes).toHaveLength(1);

      await notifRepo.update(notif.id, {
        message: "Second like",
        shouldPush: true,
        pushClaimedBy: null,
        pushClaimedAt: null,
        pushDispatchedAt: null,
      });

      const secondMessages = await dispatcher.findNotificationPushes(
        "test-dispatch-likes-2",
      );
      expect(secondMessages).toHaveLength(1);
      expect(secondMessages[0].body).toBe("Second like");

      const secondPushes = await pushService.sendMessages(secondMessages);
      expect(secondPushes).toHaveLength(1);
    });

    it("only pushes to the pre-existing device, not the new one", async () => {
      const user = await createUser();
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - milliseconds({ hours: 2 }));
      const thirtyMinutesAgo = new Date(
        now.getTime() - milliseconds({ minutes: 30 }),
      );

      // Old device registered 2 hours ago
      const oldDevice = await createDevice(user, twoHoursAgo);

      // New device registered now
      const newDevice = await createDevice(user, now);

      // Notification created 30 minutes ago
      await createNotification(user, thirtyMinutesAgo);

      const messages =
        await dispatcher.findNotificationPushes("test-dispatch-3");

      expect(messages).toHaveLength(1);
      expect(messages[0].expoPushToken).toBe(oldDevice.expoPushToken);
      expect(messages[0].expoPushToken).not.toBe(newDevice.expoPushToken);
    });

    it("does not push a notification read after it was due", async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - milliseconds({ hours: 1 }));
      const fiveMinutesAgo = new Date(
        now.getTime() - milliseconds({ minutes: 5 }),
      );

      await createDevice(user, oneHourAgo);
      await createNotification(user, fiveMinutesAgo, { readAt: now });

      const messages = await dispatcher.findNotificationPushes(
        "test-dispatch-read-after-due",
      );

      expect(messages).toHaveLength(0);
    });

    it("pushes a notification read before it was due", async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - milliseconds({ hours: 1 }));
      const fiveMinutesAgo = new Date(
        now.getTime() - milliseconds({ minutes: 5 }),
      );

      await createDevice(user, oneHourAgo);
      await createNotification(user, fiveMinutesAgo, { readAt: oneHourAgo });

      const messages = await dispatcher.findNotificationPushes(
        "test-dispatch-read-before-due",
      );

      expect(messages).toHaveLength(1);
    });

    it("does not push unread content read after it was due", async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - milliseconds({ hours: 1 }));
      const fiveMinutesAgo = new Date(
        now.getTime() - milliseconds({ minutes: 5 }),
      );

      await createDevice(user, oneHourAgo);
      await createForumReplyUnreadContent(user, fiveMinutesAgo, now);

      const messages = await dispatcher.findUnreadContentPushes(
        "test-dispatch-unread-read-after-due",
      );

      expect(messages).toHaveLength(0);
    });

    it("pushes unread content read before it was due", async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - milliseconds({ hours: 1 }));
      const fiveMinutesAgo = new Date(
        now.getTime() - milliseconds({ minutes: 5 }),
      );

      await createDevice(user, oneHourAgo);
      await createForumReplyUnreadContent(user, fiveMinutesAgo, oneHourAgo);

      const messages = await dispatcher.findUnreadContentPushes(
        "test-dispatch-unread-read-before-due",
      );

      expect(messages).toHaveLength(1);
    });

    it("pushes a like with its sole liker's current name", async () => {
      const owner = await createUser({ pushesForLikes: true });
      const liker = await createUser({ name: "Lane Before" });
      await createDevice(
        owner,
        new Date(Date.now() - milliseconds({ hours: 1 })),
      );
      const post = await ctx.dataSource.getRepository(Post).save({
        title: "Pushed Post",
        author: owner,
        authors: [],
        editableContent: { body: "Body", attachments: [] },
        deletedAt: null,
        visibleAt: new Date(),
      });
      await ctx.app.get(LikeNotificationService).createOrUpdate({
        owner,
        liker,
        targetType: "post",
        targetId: post.id,
        webAppLocation: `/forum/post/${post.id}`,
        targetContent: post.title,
      });
      await userRepo.update(liker.id, { name: "Lane After" });
      await notifRepo.update(
        { user: { id: owner.id } },
        { sendTime: new Date(Date.now() - 1000) },
      );

      const messages =
        await dispatcher.findNotificationPushes("test-dispatch-like");
      expect(
        messages
          .filter((message) => message.userId === owner.id)
          .map((message) => message.body),
      ).toEqual(["Lane After liked your post: Pushed Post"]);
    });

    it("pushes a referenced notification with the member's current name", async () => {
      const user = await createUser();
      const friend = await createUser({ name: "Quinn Before" });
      const oneHourAgo = new Date(Date.now() - milliseconds({ hours: 1 }));
      await createDevice(user, oneHourAgo);
      await ctx.app.get(NotifsService).sendNotif({
        user,
        category: NotificationCategory.FriendRequest,
        message: notifMessage`${member(friend)} wants to be friends`,
        destination: userDestination(friend.id),
        webAppLocation: `/profile/${friend.id}`,
        associatedUsers: [friend],
        sendTime: new Date(Date.now() - 1000),
      });

      await userRepo.update(friend.id, { name: "Quinn After" });

      const messages = await dispatcher.findNotificationPushes(
        "test-dispatch-referenced",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe("Quinn After wants to be friends");
    });

    it("does not push a referenced notification whose action was deleted", async () => {
      const user = await createUser();
      await createDevice(
        user,
        new Date(Date.now() - milliseconds({ hours: 1 })),
      );
      const deleted = await ctx.dataSource.getRepository(Action).save({
        name: "Deleted Action",
        category: [],
        body: "Body",
        visibilityMode: VisibilityMode.Public,
      });
      const notif = await ctx.app.get(NotifsService).sendNotif({
        user,
        category: NotificationCategory.ActionEvent,
        message: notifMessage`You missed tasks in ${action(deleted)}`,
        destination: null,
        webAppLocation: "/tasks",
        associatedUsers: [],
        shouldPush: true,
        sendTime: new Date(Date.now() - 1000),
      });

      await ctx.dataSource.getRepository(Action).delete(deleted.id);

      const messages = await dispatcher.findNotificationPushes(
        "test-dispatch-deleted-action",
      );
      expect(
        messages.filter((message) => message.notification?.id === notif.id),
      ).toEqual([]);
      expect(
        (await notifRepo.findOneByOrFail({ id: notif.id })).shouldPush,
      ).toBe(false);
    });

    it("drops the push of a reply whose comment was deleted", async () => {
      const user = await createUser();
      const now = new Date();
      await createDevice(
        user,
        new Date(now.getTime() - milliseconds({ hours: 1 })),
      );
      const row = await createForumReplyUnreadContent(
        user,
        new Date(now.getTime() - milliseconds({ minutes: 5 })),
        new Date(now.getTime() - milliseconds({ hours: 1 })),
      );
      await ctx.dataSource
        .getRepository(Comment)
        .update(row.contentId, { deletedAt: new Date() });

      const messages = await dispatcher.findUnreadContentPushes(
        "test-dispatch-deleted-comment",
      );

      expect(messages.filter((message) => message.userId === user.id)).toEqual(
        [],
      );
      expect(
        (await unreadContentRepo.findOneByOrFail({ id: row.id })).shouldPush,
      ).toBe(false);
    });

    it("judges an action's launch by the database clock when the server's clock runs behind", async () => {
      const member = await createUser();
      const now = new Date();
      await createDevice(
        member,
        new Date(now.getTime() - milliseconds({ hours: 2 })),
      );
      const action = await ctx.dataSource.getRepository(Action).save({
        name: "Just Launched",
        category: [],
        body: "Body",
        visibilityMode: VisibilityMode.Public,
      });
      await ctx.dataSource.getRepository(ActionEvent).save({
        title: "Launch",
        description: "Members act",
        newStatus: ActionStatus.MemberAction,
        date: new Date(now.getTime() - milliseconds({ minutes: 1 })),
        action,
      });
      const comment = await createActionReply({
        action,
        author: member,
        body: "Reply at launch",
      });
      const row = await ctx.app
        .get(NotifsService)
        .createForumReplyNotif(comment, member);

      jest.setSystemTime(new Date(now.getTime() - milliseconds({ hours: 1 })));
      try {
        const messages = await dispatcher.findUnreadContentPushes(
          "test-dispatch-clock-skew",
        );
        expect(messages.map((message) => message.userId)).toContain(member.id);
      } finally {
        jest.setSystemTime();
      }
      expect(
        (await unreadContentRepo.findOneByOrFail({ id: row.id })).shouldPush,
      ).toBe(true);
    });

    it("pushes a reply on an archived action only to the recipient who can still see it", async () => {
      const admin = await createUser({ admin: true });
      const memberUser = await createUser();
      const oneHourAgo = new Date(Date.now() - milliseconds({ hours: 1 }));
      await createDevice(admin, oneHourAgo);
      await createDevice(memberUser, oneHourAgo);
      const action = await ctx.dataSource.getRepository(Action).save({
        name: "Archived Action",
        category: [],
        body: "Body",
        visibilityMode: VisibilityMode.Public,
        archived: true,
      });
      const comment = await createActionReply({
        action,
        author: admin,
        body: "Reply on an archived action",
      });
      const notifs = ctx.app.get(NotifsService);
      await notifs.createForumReplyNotif(comment, admin);
      await notifs.createForumReplyNotif(comment, memberUser);

      const messages = await dispatcher.findUnreadContentPushes(
        "test-dispatch-per-recipient",
      );
      expect(
        messages
          .map((message) => message.userId)
          .filter((id) => id === admin.id || id === memberUser.id),
      ).toEqual([admin.id]);
      expect(
        await unreadContentRepo.findOneByOrFail({
          user: { id: memberUser.id },
          contentId: comment.id,
        }),
      ).toMatchObject({ shouldPush: false });
    });

    it("pushes a reply on a cohort action only to the member its saved decision admits", async () => {
      const admitted = await createUser();
      const outsider = await createUser();
      const oneHourAgo = new Date(Date.now() - milliseconds({ hours: 1 }));
      await createDevice(admitted, oneHourAgo);
      await createDevice(outsider, oneHourAgo);
      const action = await ctx.dataSource.getRepository(Action).save({
        name: "Cohort Action",
        category: [],
        body: "Body",
        visibilityMode: VisibilityMode.ParticipatingGroups,
        cohortExpression: { type: "Manual", userIds: [] },
      });
      await ctx.dataSource.getRepository(ActionEvent).save({
        title: "Members act",
        description: "Member phase",
        newStatus: ActionStatus.MemberAction,
        date: oneHourAgo,
        action,
      });
      await ctx.dataSource.getRepository(ActionCohortDecision).save({
        actionId: action.id,
        userId: admitted.id,
        included: true,
        reason: CohortDecisionReason.Launch,
        resolvedAt: oneHourAgo,
      });
      const comment = await createActionReply({
        action,
        author: admitted,
        body: "Reply on a cohort action",
      });
      const notifs = ctx.app.get(NotifsService);
      await notifs.createForumReplyNotif(comment, admitted);
      await notifs.createForumReplyNotif(comment, outsider);

      const messages = await dispatcher.findUnreadContentPushes(
        "test-dispatch-cohort",
      );
      expect(
        messages
          .map((message) => message.userId)
          .filter((id) => id === admitted.id || id === outsider.id),
      ).toEqual([admitted.id]);
    });

    it("pushes a reply on a cohort action only to the member its live cohort admits", async () => {
      const outsider = await createUser();
      const inCohort = await createUser();
      const oneHourAgo = new Date(Date.now() - milliseconds({ hours: 1 }));
      await createDevice(outsider, oneHourAgo);
      await createDevice(inCohort, oneHourAgo);
      const action = await ctx.dataSource.getRepository(Action).save({
        name: "Live Cohort Action",
        category: [],
        body: "Body",
        visibilityMode: VisibilityMode.ParticipatingGroups,
        cohortExpression: { type: "Manual", userIds: [inCohort.id] },
      });
      await ctx.dataSource.getRepository(ActionEvent).save({
        title: "Members act",
        description: "Member phase",
        newStatus: ActionStatus.MemberAction,
        date: oneHourAgo,
        action,
      });
      const comment = await createActionReply({
        action,
        author: inCohort,
        body: "Reply on a live cohort action",
      });
      const notifs = ctx.app.get(NotifsService);
      await notifs.createForumReplyNotif(comment, outsider);
      await notifs.createForumReplyNotif(comment, inCohort);

      const messages = await dispatcher.findUnreadContentPushes(
        "test-dispatch-live-cohort",
      );
      expect(
        messages
          .map((message) => message.userId)
          .filter((id) => id === inCohort.id || id === outsider.id),
      ).toEqual([inCohort.id]);
    });

    it("evaluates a live cohort only for recipients whose rows are about its action", async () => {
      const cohortRecipient = await createUser();
      const bystander = await createUser();
      const oneHourAgo = new Date(Date.now() - milliseconds({ hours: 1 }));
      await createDevice(cohortRecipient, oneHourAgo);
      await createDevice(bystander, oneHourAgo);
      const cohortAction = await ctx.dataSource.getRepository(Action).save({
        name: "Scoped Cohort Action",
        category: [],
        body: "Body",
        visibilityMode: VisibilityMode.ParticipatingGroups,
        cohortExpression: { type: "Manual", userIds: [cohortRecipient.id] },
      });
      const publicAction = await ctx.dataSource.getRepository(Action).save({
        name: "Scoped Public Action",
        category: [],
        body: "Body",
        visibilityMode: VisibilityMode.Public,
      });
      await ctx.dataSource.getRepository(ActionEvent).save(
        [cohortAction, publicAction].map((action) => ({
          title: "Members act",
          description: "Member phase",
          newStatus: ActionStatus.MemberAction,
          date: oneHourAgo,
          action,
        })),
      );
      const notifs = ctx.app.get(NotifsService);
      await notifs.createForumReplyNotif(
        await createActionReply({
          action: cohortAction,
          author: cohortRecipient,
          body: "Reply on the cohort action",
        }),
        cohortRecipient,
      );
      await notifs.createForumReplyNotif(
        await createActionReply({
          action: publicAction,
          author: bystander,
          body: "Reply on the public action",
        }),
        bystander,
      );
      const liveCohort = jest.spyOn(
        ctx.app.get(SingleMemberCohortService),
        "computeIsInActionCohort",
      );

      try {
        const messages = await dispatcher.findUnreadContentPushes(
          "test-dispatch-scoped-cohort",
        );
        expect(
          messages
            .map((message) => message.userId)
            .filter((id) => id === cohortRecipient.id || id === bystander.id)
            .sort(),
        ).toEqual([cohortRecipient.id, bystander.id].sort());
        const evaluated = liveCohort.mock.calls.map(([call]) => call.user.id);
        expect(evaluated).toContain(cohortRecipient.id);
        expect(evaluated).not.toContain(bystander.id);
      } finally {
        liveCohort.mockRestore();
      }
    });
  });

  describe("rows of a deleted recipient", () => {
    const deletedUser = async () => {
      const user = await createUser();
      await ctx.dataSource.manager.softDelete(User, [user.id]);
      return user;
    };
    const due = () => new Date(Date.now() - milliseconds({ minutes: 1 }));

    it("claims a live member's notification beside a deleted member's", async () => {
      const make = (user: User) =>
        notifRepo.save(
          notifRepo.create({
            format: NotificationFormat.Legacy,
            user,
            message: "Due",
            category: NotificationCategory.ActionEvent,
            webAppLocation: "/test",
            mobileAppLocation: "/test",
            shouldPush: true,
            sendTime: due(),
          }),
        );
      const live = await make(await createUser());
      const orphan = await make(await deletedUser());

      await dispatcher.findNotificationPushes("deleted-recipient-notif");

      expect(await notifRepo.findOneByOrFail({ id: live.id })).toMatchObject({
        pushClaimedBy: "deleted-recipient-notif",
      });
      expect(await notifRepo.findOneByOrFail({ id: orphan.id })).toMatchObject({
        pushClaimedBy: null,
      });
    });

    it("skips a deleted member's unread entry", async () => {
      const orphan = await unreadContentRepo.save(
        unreadContentRepo.create({
          user: await deletedUser(),
          contentType: UnreadContentType.ActionUpdate,
          contentId: 1,
          sendTime: due(),
          shouldPush: true,
        }),
      );

      await dispatcher.findUnreadContentPushes("deleted-recipient-uc");

      expect(
        await unreadContentRepo.findOneByOrFail({ id: orphan.id }),
      ).toMatchObject({ pushClaimedBy: null });
    });
  });
});
