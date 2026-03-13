import type { Repository } from 'typeorm';
import { Expo } from 'expo-server-sdk';
import { User } from 'src/user/entities/user.entity';
import { UserDevice } from 'src/user/entities/user-device.entity';
import { Push } from 'src/push/push.entity';
import { EXPO_CLIENT, PushService } from 'src/push/push.service';
import {
  Notification,
  NotificationCategory,
} from 'src/notifs/entities/notification.entity';
import { NotifPushDispatcherWorker } from 'src/push/notif-push-dispatcher.worker';
import { MessagingModule } from 'src/messaging/messaging.module';
import { createTestApp, TestContext } from './e2e-test-utils';

describe('NotifPushDispatcher – new device filtering (e2e)', () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let deviceRepo: Repository<UserDevice>;
  let pushRepo: Repository<Push>;
  let notifRepo: Repository<Notification>;
  let pushService: PushService;
  let dispatcher: NotifPushDispatcherWorker;
  let mockSendPush: jest.Mock;
  let userCounter = 0;

  const createUser = async (overrides: Partial<User> = {}): Promise<User> => {
    userCounter += 1;
    const user = userRepo.create({
      name: `Dispatcher User ${userCounter}`,
      email: `dispatcheruser${userCounter}@example.com`,
      password: 'pass',
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
      deviceType: 'iOS',
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
      user,
      message: 'Test push notification',
      category: NotificationCategory.ActionEvent,
      webAppLocation: '/test',
      mobileAppLocation: '/test',
      shouldPush: true,
      sendTime,
      ...overrides,
    });
    return notifRepo.save(notif);
  };

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    userRepo = ctx.dataSource.getRepository(User);
    deviceRepo = ctx.dataSource.getRepository(UserDevice);
    pushRepo = ctx.dataSource.getRepository(Push);
    notifRepo = ctx.dataSource.getRepository(Notification);
    pushService = ctx.app.get(PushService);
    dispatcher = ctx.app.get(NotifPushDispatcherWorker);

    // Mock the Expo client so we never hit the real push service
    const expo = ctx.app.get<Expo>(EXPO_CLIENT);
    mockSendPush = jest.fn(async (messages) =>
      messages.map(() => ({ status: 'ok', id: `receipt-${Date.now()}` })),
    );
    jest
      .spyOn(expo, 'chunkPushNotifications')
      .mockImplementation((msgs) => [msgs]);
    jest
      .spyOn(expo, 'sendPushNotificationsAsync')
      .mockImplementation(mockSendPush);
  }, 50000);

  afterAll(async () => {
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  beforeEach(async () => {
    await pushRepo.query('DELETE FROM push');
    await notifRepo.query('DELETE FROM notification');
    await deviceRepo.query('DELETE FROM user_device');
    mockSendPush.mockClear();
  });

  describe('getPushForAllUserDevices with notifCreatedAt filter', () => {
    it('sends to devices registered before the notification was created', async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Device registered 1 hour ago
      const device = await createDevice(user, oneHourAgo);

      // Notification created now (after device)
      const messages = await pushService.getPushForAllUserDevices(
        user.id,
        {
          body: 'Test message',
          idempotencyKey: 'test-1',
        },
        now,
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].expoPushToken).toBe(device.expoPushToken);
    });

    it('does not send to devices registered after the notification was created', async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Device registered now
      await createDevice(user, now);

      // Notification was created 1 hour ago (before device)
      const messages = await pushService.getPushForAllUserDevices(
        user.id,
        {
          body: 'Old notification',
          idempotencyKey: 'test-2',
        },
        oneHourAgo,
      );

      expect(messages).toHaveLength(0);
    });

    it('sends to old device but not new device for an old notification', async () => {
      const user = await createUser();
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Old device registered 2 hours ago
      const oldDevice = await createDevice(user, twoHoursAgo);
      // New device registered now
      await createDevice(user, now);

      // Notification created 1 hour ago (between the two device registrations)
      const messages = await pushService.getPushForAllUserDevices(
        user.id,
        {
          body: 'Mid-age notification',
          idempotencyKey: 'test-3',
        },
        oneHourAgo,
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].expoPushToken).toBe(oldDevice.expoPushToken);
    });

    it('sends to all devices when notifCreatedAt is not provided', async () => {
      const user = await createUser();
      const now = new Date();

      const device1 = await createDevice(user, now);
      const device2 = await createDevice(user, now);

      const messages = await pushService.getPushForAllUserDevices(user.id, {
        body: 'No filter',
        idempotencyKey: 'test-4',
      });

      expect(messages).toHaveLength(2);
      const tokens = messages.map((m) => m.expoPushToken);
      expect(tokens).toContain(device1.expoPushToken);
      expect(tokens).toContain(device2.expoPushToken);
    });
  });

  describe('dispatcher integration', () => {
    it('does not push old notifications to a newly registered device', async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Notification created 1 hour ago
      await createNotification(user, oneHourAgo);

      // Device registered now (after the notification)
      await createDevice(user, now);

      // Run the dispatcher (call private method directly to bypass NODE_ENV check)
      const messages =
        await dispatcher.findNotificationPushes('test-dispatch-1');

      // No messages should be generated since the device was registered after the notification
      expect(messages).toHaveLength(0);
    });

    it('pushes notifications to devices that existed before the notification', async () => {
      const user = await createUser();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Device registered 1 hour ago
      const device = await createDevice(user, oneHourAgo);

      // Notification created 5 minutes ago (after device)
      await createNotification(user, fiveMinutesAgo);

      const messages =
        await dispatcher.findNotificationPushes('test-dispatch-2');

      expect(messages).toHaveLength(1);
      expect(messages[0].expoPushToken).toBe(device.expoPushToken);
      expect(messages[0].body).toBe('Test push notification');
    });

    it('only pushes to the pre-existing device, not the new one', async () => {
      const user = await createUser();
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      // Old device registered 2 hours ago
      const oldDevice = await createDevice(user, twoHoursAgo);

      // New device registered now
      const newDevice = await createDevice(user, now);

      // Notification created 30 minutes ago
      await createNotification(user, thirtyMinutesAgo);

      const messages =
        await dispatcher.findNotificationPushes('test-dispatch-3');

      expect(messages).toHaveLength(1);
      expect(messages[0].expoPushToken).toBe(oldDevice.expoPushToken);
      expect(messages[0].expoPushToken).not.toBe(newDevice.expoPushToken);
    });
  });
});
