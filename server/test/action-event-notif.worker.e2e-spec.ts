import { Temporal } from '@js-temporal/polyfill';
import { ActionTaskType, Action } from 'src/actions/entities/action.entity';
import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import {
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from 'src/actions/entities/reminder-group.entity';
import { ActionEventNotifWorker } from 'src/notifs/action-event-notif.worker';
import { ActionEventNotif } from 'src/notifs/entities/action-event-notif.entity';
import { NotificationChannel } from 'src/notifs/notif-utils';
import { Group } from 'src/user/entities/group.entity';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import {
  ActionActivity,
  ActionActivityType,
} from 'src/actions/entities/action-activity.entity';
import { createTestApp, TestContext } from './e2e-test-utils';
import { ActionSuite } from 'src/actions/entities/action-suite.entity';

describe('ActionEventNotifWorker (e2e)', () => {
  let ctx: TestContext;
  let worker: ActionEventNotifWorker;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let reminderGroupRepo: Repository<ReminderGroup>;
  let notifRepo: Repository<ActionEventNotif>;
  let userRepo: Repository<User>;
  let activityRepo: Repository<ActionActivity>;
  let groupRepo: Repository<Group>;
  let actionSuiteRepo: Repository<ActionSuite>;

  const baseMessages = {
    emailMessage: 'Reminder for #{firstname} on #{action}',
    emailSubject: 'Reminder: #{action}',
    textMessage: 'Hi #{firstname}, remember #{action}',
  };

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    worker = ctx.app.get(ActionEventNotifWorker);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    reminderGroupRepo = ctx.dataSource.getRepository(ReminderGroup);
    notifRepo = ctx.dataSource.getRepository(ActionEventNotif);
    userRepo = ctx.dataSource.getRepository(User);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    groupRepo = ctx.dataSource.getRepository(Group);
    actionSuiteRepo = ctx.dataSource.getRepository(ActionSuite);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const resetPrimaryUser = async () => {
    await userRepo.update(ctx.testUserId, {
      contractDateSigned: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      contractDateSuspended: null,
      turnedOffAllNotifs: false,
      emailNotifsEnabled: false,
      textNotifsEnabled: true,
      phoneNumber: '+15555550100',
      phoneNumberValidated: true,
      name: 'Reminder Tester',
    });
  };

  const getPrimaryUser = () =>
    userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
      relations: ['groups'],
    });

  const createActionWithMemberEvent = async ({
    name,
    eventDate,
    participatingGroups,
    suite,
    suiteManaged,
  }: {
    name: string;
    eventDate: Date;
    participatingGroups?: Group[];
    suite?: ActionSuite;
    suiteManaged?: boolean;
  }) => {
    const action = await actionRepo.save(
      actionRepo.create({
        name,
        category: 'Testing',
        body: 'Body copy',
        shortDescription: 'Short description',
        type: ActionTaskType.Activity,
        commitmentless: true,
        everyoneShouldComplete: false,
        participatingGroups: participatingGroups ?? [ctx.defaultGroup],
        suite,
      }),
    );

    const memberEvent = await eventRepo.save(
      eventRepo.create({
        title: `${name} member event`,
        description: 'desc',
        newStatus: ActionStatus.MemberAction,
        date: eventDate,
        showInTimeline: true,
        action,
        suiteManaged: suiteManaged ?? false,
      }),
    );

    return { action, memberEvent };
  };

  const createReminderGroup = async (
    memberActionEvent: ActionEvent,
    timingMode: ReminderGroupTimingMode,
    cohortType: ReminderCohortType,
    overrides?: Partial<ReminderGroup>,
  ) => {
    return reminderGroupRepo.save(
      reminderGroupRepo.create({
        name: uniqueName(`${timingMode}-${cohortType}`),
        memberActionEvent,
        timingMode,
        cohortType,
        emailMessage: baseMessages.emailMessage,
        emailSubject: baseMessages.emailSubject,
        textMessage: baseMessages.textMessage,
        allSent: false,
        ...overrides,
      }),
    );
  };

  const fetchNotifsForGroup = async (group: ReminderGroup) =>
    notifRepo.find({
      where: { reminderGroup: { id: group.id } },
      relations: ['user', 'reminderGroup'],
    });

  const recordCompletion = (user: User, action: Action) =>
    activityRepo.save(
      activityRepo.create({
        action,
        actionId: action.id,
        user,
        userId: user.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
    );

  beforeEach(async () => {
    await notifRepo.query('DELETE FROM action_event_notif');
    await reminderGroupRepo.query('DELETE FROM reminder_group');
    await activityRepo.query('DELETE FROM action_activity');
    await eventRepo.query('DELETE FROM action_event');
    await actionRepo.query('DELETE FROM action');
    await actionSuiteRepo.query('DELETE FROM action_suite');
    await resetPrimaryUser();
  });

  it('sends email reminders for absolute timing groups to eligible users', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await userRepo.update(user.id, {
      contractDateSigned: new Date(now - 24 * 60 * 60 * 1000),
    });

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('absolute-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs.map((notif) => notif.user.id)).toHaveLength(1);
    expect(notifs[0].user.id).toBe(user.id);
    expect(notifs[0].channel).toBe(NotificationChannel.Text);
  });

  it('guards against duplicate reminders via idempotency keys', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await userRepo.update(user.id, {
      contractDateSigned: new Date(now - 24 * 60 * 60 * 1000),
    });

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('duplicate-action'),
      eventDate: new Date(now - 45 * 60 * 1000),
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 10 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();
    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs.map((notif) => notif.user.id)).toHaveLength(1);
    expect(notifs[0].channel).toBe(NotificationChannel.Text);
  });

  it('skips users who have already completed the action', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await userRepo.update(user.id, {
      contractDateSigned: new Date(now - 7 * 24 * 60 * 60 * 1000),
    });

    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('completed-action'),
      eventDate: new Date(now - 30 * 60 * 1000),
    });

    await activityRepo.save(
      activityRepo.create({
        action,
        actionId: action.id,
        user,
        userId: user.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
    );

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 15 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(0);
  });

  it('sends reminders to joined users who have not completed the action', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await userRepo.update(user.id, {
      contractDateSigned: new Date(now - 5 * 24 * 60 * 60 * 1000),
    });

    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('joined-action'),
      eventDate: new Date(now - 50 * 60 * 1000),
    });

    await activityRepo.save(
      activityRepo.create({
        action,
        actionId: action.id,
        user,
        userId: user.id,
        type: ActionActivityType.USER_JOINED,
      }),
    );

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 6 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs.map((notif) => notif.user.id)).toHaveLength(1);
    expect(notifs[0].user.id).toBe(user.id);
  });

  it('does not send reminders to users without signed contracts', async () => {
    const now = Date.now();
    await userRepo.update(ctx.testUserId, {
      contractDateSigned: null,
    });

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('no-contract-action'),
      eventDate: new Date(now - 20 * 60 * 1000),
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs.map((notif) => notif.user.id)).toHaveLength(0);

    await resetPrimaryUser();
  });

  it('blocks notifications for users with suspended contracts', async () => {
    const now = Date.now();
    await userRepo.update(ctx.testUserId, {
      contractDateSigned: new Date(now - 24 * 60 * 60 * 1000),
      contractDateSuspended: new Date(now - 60 * 60 * 1000),
    });

    const user = await getPrimaryUser();

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('suspended-action'),
      eventDate: new Date(now - 30 * 60 * 1000),
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 4 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs.map((notif) => notif.user.id)).toHaveLength(0);

    await userRepo.update(user.id, { contractDateSuspended: null });
  });

  it('sends reminders only to members of a custom cohort', async () => {
    const now = Date.now();
    const primaryUser = await getPrimaryUser();
    await userRepo.update(primaryUser.id, {
      contractDateSigned: new Date(now - 48 * 60 * 60 * 1000),
    });

    const customUser = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('custom')}@example.com`,
        password: 'pass',
        name: 'Custom User',
        groups: primaryUser.groups,
        contractDateSigned: new Date(now - 48 * 60 * 60 * 1000),
        textNotifsEnabled: true,
        phoneNumber: '+15555550200',
        phoneNumberValidated: true,
        emailNotifsEnabled: false,
      }),
    );
    const customUserWithGroups = await userRepo.findOneOrFail({
      where: { id: customUser.id },
      relations: ['groups'],
    });

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('custom-cohort-action'),
      eventDate: new Date(now - 40 * 60 * 1000),
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.Custom,
      {
        users: [customUserWithGroups],
        sendAtAbsolute: new Date(now - 8 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(customUser.id);

    await userRepo.delete({ id: customUser.id });
  });

  it('targets only users in the configured group cohort', async () => {
    const now = Date.now();
    const group = await groupRepo.save(
      groupRepo.create({
        name: uniqueName('reminder-group'),
        description: 'Reminder cohort group',
      }),
    );

    const cohortUser = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('cohort')}@example.com`,
        password: 'pass',
        name: 'Cohort User',
        groups: [group],
        contractDateSigned: new Date(now - 48 * 60 * 60 * 1000),
        textNotifsEnabled: true,
        phoneNumber: '+15555550300',
        phoneNumberValidated: true,
        emailNotifsEnabled: false,
      }),
    );
    const cohortUserWithGroups = await userRepo.findOneOrFail({
      where: { id: cohortUser.id },
      relations: ['groups'],
    });

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('group-cohort-action'),
      eventDate: new Date(now - 35 * 60 * 1000),
      participatingGroups: [group],
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.Group,
      {
        userGroup: group,
        sendAtAbsolute: new Date(now - 6 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(cohortUserWithGroups.id);

    await userRepo.delete({ id: cohortUser.id });
  });

  it('respects deadlines when scheduling reminders from a deadline offset', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await userRepo.update(user.id, {
      contractDateSigned: new Date(now - 5 * 24 * 60 * 60 * 1000),
    });

    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('deadline-action'),
      eventDate: new Date(now - 2 * 60 * 60 * 1000),
    });

    const deadlineEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Deadline event',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 30 * 60 * 1000),
        showInTimeline: false,
        action,
      }),
    );

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.FromDeadline,
      ReminderCohortType.AllUncompleted,
      {
        deadlineEvent,
        sendAtSecondsFromDeadline: 60 * 60,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(user.id);
  });

  it('schedules reminders within ranges based on user preference', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    const preferredStart = new Date(now - 4 * 60 * 1000);
    const preferredInstant = Temporal.Instant.from(
      preferredStart.toISOString(),
    );
    const preferredTime = preferredInstant
      .toZonedDateTimeISO('UTC')
      .toPlainTime();

    await userRepo.update(user.id, {
      contractDateSigned: new Date(now - 6 * 24 * 60 * 60 * 1000),
      timeZone: 'UTC',
      preferredReminderTime: preferredTime,
    });

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('range-action'),
      eventDate: new Date(now - 3 * 60 * 60 * 1000),
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.WithinRange,
      ReminderCohortType.AllUncompleted,
      {
        send_range_start: preferredStart,
        send_range_end: new Date(now + 60 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(user.id);
    expect(notifs[0].channel).toBe(NotificationChannel.Text);
  });

  it('sends suite reminders to users missing any suite actions', async () => {
    const now = Date.now();
    await userRepo.update(ctx.testUserId, { contractDateSigned: null });

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({
        name: uniqueName('suite-reminder'),
      }),
    );

    const eventDate = new Date(now - 60 * 60 * 1000);

    const { action: firstAction, memberEvent } =
      await createActionWithMemberEvent({
        name: uniqueName('suite-action-one'),
        eventDate,
        suite,
        suiteManaged: true,
      });

    const { action: secondAction } = await createActionWithMemberEvent({
      name: uniqueName('suite-action-two'),
      eventDate,
      suite,
      suiteManaged: true,
    });

    const suiteWithActions = await actionSuiteRepo.findOneOrFail({
      where: { id: suite.id },
      relations: ['actions'],
    });

    const createSuiteUser = async (
      label: string,
      phoneSuffix: string,
    ): Promise<User> =>
      userRepo.save(
        userRepo.create({
          email: `${uniqueName(`suite-${label}`)}@example.com`,
          password: 'pass',
          name: `Suite ${label}`,
          groups: [ctx.defaultGroup],
          contractDateSigned: new Date(now - 72 * 60 * 60 * 1000),
          contractDateSuspended: null,
          textNotifsEnabled: true,
          phoneNumber: `+1555555${phoneSuffix}`,
          phoneNumberValidated: true,
          emailNotifsEnabled: false,
          turnedOffAllNotifs: false,
        }),
      );

    const [noCompletion, firstOnly, secondOnly, bothCompleted] =
      await Promise.all([
        createSuiteUser('none', '2001'),
        createSuiteUser('first', '2002'),
        createSuiteUser('second', '2003'),
        createSuiteUser('both', '2004'),
      ]);

    await recordCompletion(firstOnly, firstAction);
    await recordCompletion(secondOnly, secondAction);
    await recordCompletion(bothCompleted, firstAction);
    await recordCompletion(bothCompleted, secondAction);

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        actionSuite: suiteWithActions,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    const notifiedUserIds = notifs.map((notif) => notif.user.id);

    expect(notifiedUserIds).toHaveLength(3);
    expect(notifiedUserIds).toEqual(
      expect.arrayContaining([noCompletion.id, firstOnly.id, secondOnly.id]),
    );
    expect(notifiedUserIds).not.toContain(bothCompleted.id);

    await userRepo.delete([
      noCompletion.id,
      firstOnly.id,
      secondOnly.id,
      bothCompleted.id,
    ]);
  });

  it('does not send suite reminders when users completed every suite action', async () => {
    const now = Date.now();
    await userRepo.update(ctx.testUserId, { contractDateSigned: null });

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({
        name: uniqueName('suite-reminder-none'),
      }),
    );

    const newgroup = groupRepo.create({
      name: uniqueName('suite-reminder-none-group'),
      description: 'Suite reminder none group',
    });
    const savedGroup = await groupRepo.save(newgroup);

    const eventDate = new Date(now - 45 * 60 * 1000);

    const { action: firstAction, memberEvent } =
      await createActionWithMemberEvent({
        name: uniqueName('suite-reminder-none-one'),
        eventDate,
        suite,
        suiteManaged: true,
        participatingGroups: [savedGroup],
      });

    const { action: secondAction } = await createActionWithMemberEvent({
      name: uniqueName('suite-reminder-none-two'),
      eventDate,
      suite,
      suiteManaged: true,
    });

    const suiteWithActions = await actionSuiteRepo.findOneOrFail({
      where: { id: suite.id },
      relations: ['actions'],
    });

    const completeUser = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('suite-complete')}@example.com`,
        password: 'pass',
        name: 'Suite Completer',
        groups: [savedGroup],
        contractDateSigned: new Date(now - 6 * 24 * 60 * 60 * 1000),
        contractDateSuspended: null,
        textNotifsEnabled: true,
        phoneNumber: '+15555552005',
        phoneNumberValidated: true,
        emailNotifsEnabled: false,
        turnedOffAllNotifs: false,
      }),
    );

    await recordCompletion(completeUser, firstAction);
    await recordCompletion(completeUser, secondAction);

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        actionSuite: suiteWithActions,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs.map((n) => n.user.id)).toHaveLength(0);

    await userRepo.delete({ id: completeUser.id });
  });

  it('replaces placeholders in custom reminder text', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await userRepo.update(user.id, {
      contractDateSigned: new Date(now - 24 * 60 * 60 * 1000),
      name: 'Reminder Tester',
    });

    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('template-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 10 * 60 * 1000),
      },
    );

    const text = await worker.processCustomReminderText(
      'Hi #{firstname}, #{action} is waiting.',
      {
        user,
        group: reminderGroup,
        scheduledFor: new Date(),
      },
      'cid-123',
    );

    expect(text).toContain('Hi Reminder');
    expect(text).toContain(action.name);
    expect(text).not.toContain('#{');
  });
});
