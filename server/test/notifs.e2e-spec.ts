import { createTestApp, TestContext } from './e2e-test-utils';
import {
  Notification,
  NotificationType,
} from '../src/notifs/entities/notification.entity';
import { NotifsModule } from 'src/notifs/notifs.module';
import { Repository } from 'typeorm';
import { User } from 'src/user/user.entity';

describe('Notifications (e2e)', () => {
  let ctx: TestContext;
  let notifRepo: Repository<Notification>;
  let notifId: number;

  beforeAll(async () => {
    ctx = await createTestApp([NotifsModule]);
    notifRepo = ctx.dataSource.getRepository(Notification);
    const userRepo = ctx.dataSource.getRepository(User);

    const testUser = await userRepo.findOne({
      where: {
        id: ctx.testUserId,
      },
    });

    if (!testUser) {
      throw new Error('Test user not found');
    }

    const testNotif = notifRepo.create({
      user: testUser,
      message: 'Test notification',
      category: NotificationType.FriendRequest,
      webAppLocation: 'test',
      mobileAppLocation: 'test',
    });
    await notifRepo.save(testNotif);
    notifId = testNotif.id;
  }, 50000);

  it('user can list their notifications', async () => {
    const res = await ctx.agent.get('/notifs').expect(200);
    expect(res.body.length).toBe(1);
  });

  it('user can mark notification as read', async () => {
    await ctx.agent.post(`/notifs/read/${notifId}`).expect(201);

    const notifs = await ctx.agent.get('/notifs').expect(200);
    expect(notifs.body[0].read).toBe(true);
  });

  describe('Push Token Endpoints', () => {
    const pushToken = 'test-push-token-123';

    it('user can save a push token', async () => {
      const res = await ctx.agent
        .post('/user/pushToken')
        .send({ token: pushToken })
        .expect(201);

      expect(res.body).toEqual({ success: true });

      const userRepo = ctx.dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: ctx.testUserId },
      });
      expect(user && user.pushTokens).toContain(pushToken);
    });

    it('user can remove a push token', async () => {
      const userRepo = ctx.dataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: ctx.testUserId } });
      if (user && (!user.pushTokens || !user.pushTokens.includes(pushToken))) {
        user.pushTokens = [...(user.pushTokens || []), pushToken];
        await userRepo.save(user);
      }

      const res = await ctx.agent
        .post('/user/removePushToken')
        .send({ userId: ctx.testUserId, token: pushToken })
        .expect(201);

      expect(res.body).toEqual({ success: true });

      const updatedUser = await userRepo.findOne({ where: { id: ctx.testUserId } });
      expect(updatedUser && updatedUser.pushTokens).not.toContain(pushToken);
    });

  });
});