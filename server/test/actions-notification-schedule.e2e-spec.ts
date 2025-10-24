import * as request from 'supertest';
import { createTestApp, TestContext } from './e2e-test-utils';
import { Action } from 'src/actions/entities/action.entity';
import {
  ActionEvent,
  ActionStatus,
  NotificationType,
} from 'src/actions/entities/action-event.entity';
import {
  ActionActivity,
  ActionActivityType,
} from 'src/actions/entities/action-activity.entity';
import { ActionTaskType } from 'src/actions/entities/action.entity';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { ActionEventNotifType } from 'src/notifs/entities/action-event-notif.entity';
import { ProfileDto } from 'src/user/user.dto';
import {
  ActionReminder,
  ReminderCohortType,
  ReminderTimingMode,
} from 'src/actions/entities/action-reminder.entity';

describe('Notification schedule (e2e)', () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let activityRepo: Repository<ActionActivity>;
  let reminderRepo: Repository<ActionReminder>;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    reminderRepo = ctx.dataSource.getRepository(ActionReminder);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('includes future missed deadline notifications in schedule', async () => {
    const baseTime = new Date();
    const windowStart = baseTime.toISOString();
    const windowEnd = new Date(
      baseTime.getTime() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const action = await actionRepo.save(
      actionRepo.create({
        name: 'Deadline Forecast Action',
        category: 'Testing',
        body: 'Body',
        shortDescription: 'Short',
        type: ActionTaskType.Activity,
        commitmentThreshold: 1,
        participatingGroups: [ctx.defaultGroup],
      }),
    );

    const memberEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Member Action Event',
        description: 'desc',
        newStatus: ActionStatus.MemberAction,
        sendNotifsTo: NotificationType.All,
        date: new Date(baseTime.getTime() - 24 * 60 * 60 * 1000),
        showInTimeline: true,
        action,
      }),
    );

    const resolutionEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Resolution Event',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        sendNotifsTo: NotificationType.All,
        date: new Date(baseTime.getTime() + 5 * 24 * 60 * 60 * 1000),
        showInTimeline: true,
        action,
      }),
    );

    const userRepo = ctx.dataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: ctx.testUserId } });

    if (!user) {
      throw new Error('Test user missing');
    }

    await activityRepo.save(
      activityRepo.create({
        action,
        actionId: action.id,
        user,
        userId: user.id,
        type: ActionActivityType.USER_JOINED,
      }),
    );

    const response = await request(ctx.app.getHttpServer())
      .get('/actions/notification-schedule')
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .query({ windowStart, windowEnd })
      .expect(200);

    const schedule = response.body as Array<{ type: string; actionId: number }>;

    const missedDeadlineEntry = schedule.find(
      (entry) =>
        entry.type === 'misseddeadline' && entry.actionId === action.id,
    );

    expect(missedDeadlineEntry).toBeDefined();

    // Cleanup
    await activityRepo.delete({ actionId: action.id, userId: user.id });
    await eventRepo.delete(resolutionEvent.id);
    await eventRepo.delete(memberEvent.id);
    await actionRepo.delete(action.id);
  });

  it('excludes completed users from reminders for standard actions', async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const baseTime = new Date(Date.now() + 2 * dayMs);
    const memberEventDate = new Date(baseTime.getTime());
    const resolutionEventDate = new Date(baseTime.getTime() + 3 * dayMs);
    const reminderTime = new Date(resolutionEventDate.getTime() - 3 * dayMs);

    const userRepo = ctx.dataSource.getRepository(User);
    const user = await userRepo.findOneByOrFail({ id: ctx.testUserId });
    const originalContract = user.contractDateSigned;
    const action = await actionRepo.save(
      actionRepo.create({
        name: 'Standard Reminder Action',
        category: 'Testing',
        body: 'Body',
        shortDescription: 'Short',
        type: ActionTaskType.Activity,
        commitmentThreshold: 1,
        commitmentless: false,
        participatingGroups: [ctx.defaultGroup],
      }),
    );

    const memberEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Member Action Event',
        description: 'desc',
        newStatus: ActionStatus.MemberAction,
        sendNotifsTo: NotificationType.All,
        date: memberEventDate,
        showInTimeline: true,
        action,
      }),
    );

    await reminderRepo.save(
      reminderRepo.create({
        memberActionEvent: memberEvent,
        cohortType: ReminderCohortType.AllUncompleted,
        timingMode: ReminderTimingMode.Absolute,
        sendAtAbsolute: reminderTime,
        emailMessage: 'Custom email message',
        emailSubject: 'Custom email subject',
        textMessage: 'Custom text message',
      }),
    );

    const resolutionEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Resolution Event',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        sendNotifsTo: NotificationType.All,
        date: resolutionEventDate,
        showInTimeline: true,
        action,
      }),
    );

    await userRepo.update(user.id, {
      contractDateSigned: new Date(memberEventDate.getTime() - dayMs),
    });

    const joined = await activityRepo.save(
      activityRepo.create({
        action,
        actionId: action.id,
        user,
        userId: user.id,
        type: ActionActivityType.USER_JOINED,
      }),
    );
    await activityRepo.update(joined.id, {
      createdAt: new Date(memberEventDate.getTime() - 2 * 60 * 60 * 1000),
    });

    const completed = await activityRepo.save(
      activityRepo.create({
        action,
        actionId: action.id,
        user,
        userId: user.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
    );
    await activityRepo.update(completed.id, {
      createdAt: new Date(reminderTime.getTime() - 60 * 60 * 1000),
    });

    const windowStart = new Date(
      reminderTime.getTime() - 60 * 1000,
    ).toISOString();
    const windowEnd = new Date(
      reminderTime.getTime() + 60 * 1000,
    ).toISOString();

    try {
      const response = await request(ctx.app.getHttpServer())
        .get('/actions/notification-schedule')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .query({ windowStart, windowEnd })
        .expect(200);

      const schedule = response.body as Array<{
        type: string;
        actionId: number;
        recipients: Array<ProfileDto>;
      }>;

      const reminderEntry = schedule.find(
        (entry) =>
          entry.type === ActionEventNotifType.Reminder &&
          entry.actionId === action.id,
      );

      expect(reminderEntry).toBeDefined();
      expect(reminderEntry?.recipients).toHaveLength(0);
    } finally {
      await activityRepo.delete(completed.id);
      await activityRepo.delete(joined.id);
      await eventRepo.delete(resolutionEvent.id);
      await eventRepo.delete(memberEvent.id);
      await actionRepo.delete(action.id);
      await userRepo.update(user.id, { contractDateSigned: originalContract });
    }
  });

  it('filters completed commitmentless users from reminders and deadline messages', async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const baseTime = new Date(Date.now() + 3 * dayMs);
    const memberEventDate = new Date(baseTime.getTime());
    const resolutionEventDate = new Date(baseTime.getTime() + 2 * dayMs);
    const reminderTime = new Date(resolutionEventDate.getTime() - dayMs);

    const userRepo = ctx.dataSource.getRepository(User);
    const primaryUser = await userRepo.findOneByOrFail({ id: ctx.testUserId });
    const adminUser = await userRepo.findOneByOrFail({ id: ctx.adminUserId });
    const originalPrimaryContract = primaryUser.contractDateSigned;
    const originalAdminContract = adminUser.contractDateSigned;
    const eligibleSince = new Date(memberEventDate.getTime() - 2 * dayMs);

    await userRepo.update(primaryUser.id, {
      contractDateSigned: eligibleSince,
    });
    await userRepo.update(adminUser.id, {
      contractDateSigned: eligibleSince,
    });

    const action = await actionRepo.save(
      actionRepo.create({
        name: 'Commitmentless Reminder Action',
        category: 'Testing',
        body: 'Body',
        shortDescription: 'Short',
        type: ActionTaskType.Activity,
        commitmentless: true,
        participatingGroups: [ctx.defaultGroup],
      }),
    );

    const memberEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Member Action Event',
        description: 'desc',
        newStatus: ActionStatus.MemberAction,
        sendNotifsTo: NotificationType.All,
        date: memberEventDate,
        showInTimeline: true,
        action,
      }),
    );

    const resolutionEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Resolution Event',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        sendNotifsTo: NotificationType.All,
        date: resolutionEventDate,
        showInTimeline: true,
        action,
      }),
    );

    await reminderRepo.save(
      reminderRepo.create({
        memberActionEvent: memberEvent,
        cohortType: ReminderCohortType.AllUncompleted,
        timingMode: ReminderTimingMode.Absolute,
        sendAtAbsolute: reminderTime,
        emailMessage: 'Custom email message',
        emailSubject: 'Custom email subject',
        textMessage: 'Custom text message',
      }),
    );

    const completion = await activityRepo.save(
      activityRepo.create({
        action,
        actionId: action.id,
        user: primaryUser,
        userId: primaryUser.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
    );
    await activityRepo.update(completion.id, {
      createdAt: new Date(reminderTime.getTime() - 2 * 60 * 60 * 1000),
    });

    const windowStart = new Date(
      reminderTime.getTime() - 60 * 1000,
    ).toISOString();
    const windowEnd = new Date(
      reminderTime.getTime() + 60 * 1000,
    ).toISOString();

    try {
      const response = await request(ctx.app.getHttpServer())
        .get('/actions/notification-schedule')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .query({ windowStart, windowEnd })
        .expect(200);

      const schedule = response.body as Array<{
        type: string;
        actionId: number;
        recipients: Array<ProfileDto>;
      }>;

      const reminderEntry = schedule.find(
        (entry) =>
          entry.type === ActionEventNotifType.Reminder &&
          entry.actionId === action.id,
      );

      expect(reminderEntry).toBeDefined();
      expect(reminderEntry?.type).toBe(ActionEventNotifType.Reminder);
      expect(reminderEntry?.recipients).toHaveLength(1);

      const deadlineWindowStart = new Date(
        resolutionEventDate.getTime() - 60 * 1000,
      ).toISOString();
      const deadlineWindowEnd = new Date(
        resolutionEventDate.getTime() + 60 * 1000,
      ).toISOString();

      const deadlineResponse = await request(ctx.app.getHttpServer())
        .get('/actions/notification-schedule')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .query({
          windowStart: deadlineWindowStart,
          windowEnd: deadlineWindowEnd,
        })
        .expect(200);

      const deadlineSchedule = deadlineResponse.body as Array<{
        type: string;
        actionId: number;
        recipients: Array<ProfileDto>;
      }>;

      const deadlineEntry = deadlineSchedule.find(
        (entry) =>
          entry.type === ActionEventNotifType.MissedDeadline &&
          entry.actionId === action.id,
      );

      expect(deadlineEntry).toBeDefined();
      expect(deadlineEntry?.recipients).toHaveLength(1);
    } finally {
      await activityRepo.delete(completion.id);
      await eventRepo.delete(resolutionEvent.id);
      await eventRepo.delete(memberEvent.id);
      await actionRepo.delete(action.id);
      await userRepo.update(primaryUser.id, {
        contractDateSigned: originalPrimaryContract,
      });
      await userRepo.update(adminUser.id, {
        contractDateSigned: originalAdminContract,
      });
    }
  });
});
