import * as request from 'supertest';
import { Action, ActionStatus } from '../src/actions/entities/action.entity';
import { CreateActionDto } from '../src/actions/dto/action.dto';
import { createTestApp, TestContext } from './e2e-test-utils';
import { UserActionRelation } from '../src/actions/entities/user-action.entity';
import { Notification } from '../src/notifs/entities/notification.entity';
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
      category: 'test',
      webAppLocation: 'test',
      mobileAppLocation: 'test',
    });
    await notifRepo.save(testNotif);
    notifId = testNotif.id;
  });

  it('user can list their notifications', async () => {
    const res = await ctx.agent.get('/notifs').expect(200);
    expect(res.body.length).toBe(1);
  });

  it('user can mark notification as read', async () => {
    const res = await ctx.agent.post(`/notifs/read/${notifId}`).expect(201);

    const notifs = await ctx.agent.get('/notifs').expect(200);
    expect(notifs.body[0].read).toBe(true);
  });
});
