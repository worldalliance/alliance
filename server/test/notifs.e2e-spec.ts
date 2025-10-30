import { NotifsModule } from 'src/notifs/notifs.module';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationCategory,
} from '../src/notifs/entities/notification.entity';
import { createTestApp, TestContext } from './e2e-test-utils';

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
      category: NotificationCategory.FriendRequest,
      webAppLocation: 'test',
      mobileAppLocation: 'test',
    });
    await notifRepo.save(testNotif);
    notifId = testNotif.id;
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('user can list their notifications', async () => {
    const res = await ctx.agent.get('/notifs').expect(200);
    expect(res.body.length).toBe(1);
  });

  it('user can mark notification as read', async () => {
    await ctx.agent.post(`/notifs/read/${notifId}`).expect(201);

    const notifs = await ctx.agent.get('/notifs').expect(200);
    expect(notifs.body[0].read).toBe(true);
  });

  it('user can mark all notifications read and clear them', async () => {
    await ctx.agent.post('/notifs/read-all').expect(201);

    let notifs = await ctx.agent.get('/notifs').expect(200);
    expect(notifs.body.every((notif) => notif.read)).toBe(true);

    await ctx.agent.post('/notifs/clear').expect(201);

    notifs = await ctx.agent.get('/notifs').expect(200);
    expect(notifs.body.every((notif) => notif.cleared)).toBe(true);
  });
});
