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
import { Tag } from 'src/user/entities/tag.entity';
import { User } from 'src/user/entities/user.entity';
import { Community } from 'src/community/entities/community.entity';
import type { Repository } from 'typeorm';
import {
  ActionActivity,
  ActionActivityType,
} from 'src/actions/entities/action-activity.entity';
import { createTestApp, TestContext } from './e2e-test-utils';
import { ActionSuite } from 'src/actions/entities/action-suite.entity';
import {
  ContractEvent,
  ContractEventType,
} from 'src/user/entities/contract-event.entity';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';

describe('ActionEventNotifWorker (e2e)', () => {
  let ctx: TestContext;
  let worker: ActionEventNotifWorker;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let reminderGroupRepo: Repository<ReminderGroup>;
  let notifRepo: Repository<ActionEventNotif>;
  let userRepo: Repository<User>;
  let activityRepo: Repository<ActionActivity>;
  let tagRepo: Repository<Tag>;
  let actionSuiteRepo: Repository<ActionSuite>;
  let contractEventRepo: Repository<ContractEvent>;
  let communityRepo: Repository<Community>;
  let formRepo: Repository<Form>;
  let formResponseRepo: Repository<FormResponse>;

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
    tagRepo = ctx.dataSource.getRepository(Tag);
    actionSuiteRepo = ctx.dataSource.getRepository(ActionSuite);
    contractEventRepo = ctx.dataSource.getRepository(ContractEvent);
    communityRepo = ctx.dataSource.getRepository(Community);
    formRepo = ctx.dataSource.getRepository(Form);
    formResponseRepo = ctx.dataSource.getRepository(FormResponse);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const setUserContractSigned = async (userId: number, signedDate: Date) => {
    await contractEventRepo.delete({ user: { id: userId } });
    await contractEventRepo.save(
      contractEventRepo.create({
        user: { id: userId },
        type: ContractEventType.SIGNED,
        date: signedDate,
        automatic: false,
        contractId: ctx.defaultContractId,
      }),
    );
  };

  const setUserContractSuspended = async (
    userId: number,
    signedDate: Date,
    suspendedDate: Date,
  ) => {
    await contractEventRepo.delete({ user: { id: userId } });
    await contractEventRepo.save([
      contractEventRepo.create({
        user: { id: userId },
        type: ContractEventType.SIGNED,
        date: signedDate,
        automatic: false,
        contractId: ctx.defaultContractId,
      }),
      contractEventRepo.create({
        user: { id: userId },
        type: ContractEventType.SUSPENDED,
        date: suspendedDate,
        automatic: false,
      }),
    ]);
  };

  const clearUserContract = async (userId: number) => {
    await contractEventRepo.delete({ user: { id: userId } });
  };

  const resetPrimaryUser = async () => {
    await userRepo.update(ctx.testUserId, {
      turnedOffAllNotifs: false,
      emailNotifsEnabled: false,
      textNotifsEnabled: true,
      phoneNumber: '+15555550100',
      phoneNumberValidated: true,
      name: 'Reminder Tester',
    });
    await setUserContractSigned(
      ctx.testUserId,
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    );
  };

  const getPrimaryUser = () =>
    userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
      relations: { tags: true },
    });

  const createActionWithMemberEvent = async ({
    name,
    eventDate,
    suite,
    suiteManaged,
    timeEstimate,
  }: {
    name: string;
    eventDate: Date;
    suite?: ActionSuite;
    suiteManaged?: boolean;
    timeEstimate?: number;
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
        suite,
        timeEstimate,
        cohortExpression: {
          type: 'Tag',
          tagId: ctx.defaultTag.id,
        },
      }),
    );

    const memberEvent = await eventRepo.save(
      eventRepo.create({
        title: `${name} member event`,
        description: 'desc',
        newStatus: ActionStatus.MemberAction,
        date: eventDate,
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
      relations: { user: true, reminderGroup: true },
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
    await formResponseRepo.query('DELETE FROM form_response');
    await formRepo.query('DELETE FROM form');
    await resetPrimaryUser();
  });

  it('sends email reminders for absolute timing groups to eligible users', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

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

  it('does not send reminders older than the 3 hour lookback window', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('lookback-blocked'),
      eventDate: new Date(now - 7 * 60 * 60 * 1000),
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 6 * 60 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(0);
  });

  it('sends reminders that are within the 3 hour lookback window', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('lookback-allowed'),
      eventDate: new Date(now - 3 * 60 * 60 * 1000),
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 2 * 60 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs.map((notif) => notif.user.id)).toHaveLength(1);
    expect(notifs[0].user.id).toBe(user.id);
  });

  it('guards against duplicate reminders via idempotency keys', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

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
    await setUserContractSigned(
      user.id,
      new Date(now - 7 * 24 * 60 * 60 * 1000),
    );

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
    await setUserContractSigned(
      user.id,
      new Date(now - 5 * 24 * 60 * 60 * 1000),
    );

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
    await clearUserContract(ctx.testUserId);

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
    await setUserContractSuspended(
      ctx.testUserId,
      new Date(now - 24 * 60 * 60 * 1000),
      new Date(now - 60 * 60 * 1000),
    );

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
  });

  it('excludes users who suspend mid-action from AllUncompleted reminders', async () => {
    const now = Date.now();
    // User signed contract well before the action started
    // Action started 2 hours ago
    // User suspended 30 minutes ago (after action started)
    // Deadline is 1 hour in the future
    // Notification scheduled 5 minutes ago
    // The user was active at action launch but is now suspended
    await setUserContractSuspended(
      ctx.testUserId,
      new Date(now - 7 * 24 * 60 * 60 * 1000), // signed 7 days ago
      new Date(now - 30 * 60 * 1000), // suspended 30 minutes ago
    );

    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('mid-action-suspend'),
      eventDate: new Date(now - 2 * 60 * 60 * 1000), // action started 2 hours ago
    });

    // Create a deadline event so the full range check is triggered
    const deadlineEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 60 * 60 * 1000), // deadline 1 hour from now
        action,
      }),
    );

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        deadlineEvent,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(0);
  });

  it('excludes users who suspend mid-action from Custom cohort reminders', async () => {
    const now = Date.now();
    const primaryUser = await getPrimaryUser();

    // Create a custom user who was active at action launch but suspended mid-action
    const suspendedCustomUser = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('custom-suspended')}@example.com`,
        password: 'pass',
        name: 'Suspended Custom User',
        tags: primaryUser.tags,
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 7 * 24 * 60 * 60 * 1000), // signed 7 days ago
            automatic: false,
            contractId: ctx.defaultContractId,
          } as ContractEvent,
          {
            type: ContractEventType.SUSPENDED,
            date: new Date(now - 30 * 60 * 1000), // suspended 30 minutes ago
            automatic: false,
          } as ContractEvent,
        ],
        textNotifsEnabled: true,
        phoneNumber: '+15555550201',
        phoneNumberValidated: true,
        emailNotifsEnabled: false,
      }),
    );
    const suspendedUserWithTags = await userRepo.findOneOrFail({
      where: { id: suspendedCustomUser.id },
      relations: { tags: true },
    });

    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('custom-cohort-mid-suspend'),
      eventDate: new Date(now - 2 * 60 * 60 * 1000), // action started 2 hours ago
    });

    // Create a deadline event so the full range check is triggered
    const deadlineEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 60 * 60 * 1000), // deadline 1 hour from now
        action,
      }),
    );

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.Custom,
      {
        users: [suspendedUserWithTags],
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        deadlineEvent,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(0);

    await userRepo.delete({ id: suspendedCustomUser.id });
  });

  it('sends reminders only to members of a custom cohort', async () => {
    const now = Date.now();
    const primaryUser = await getPrimaryUser();
    await setUserContractSigned(
      primaryUser.id,
      new Date(now - 48 * 60 * 60 * 1000),
    );

    const customUser = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('custom')}@example.com`,
        password: 'pass',
        name: 'Custom User',
        tags: primaryUser.tags,
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 48 * 60 * 60 * 1000),
            automatic: false,
            contractId: ctx.defaultContractId,
          } as ContractEvent,
        ],
        textNotifsEnabled: true,
        phoneNumber: '+15555550200',
        phoneNumberValidated: true,
        emailNotifsEnabled: false,
      }),
    );
    const customUserWithTags = await userRepo.findOneOrFail({
      where: { id: customUser.id },
      relations: { tags: true },
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
        users: [customUserWithTags],
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
    const tag = await tagRepo.save(
      tagRepo.create({
        name: uniqueName('reminder-tag'),
        description: 'Reminder cohort tag',
      }),
    );

    const cohortUser = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('cohort')}@example.com`,
        password: 'pass',
        name: 'Cohort User',
        tags: [tag, ctx.defaultTag],
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 48 * 60 * 60 * 1000),
            automatic: false,
            contractId: ctx.defaultContractId,
          } as ContractEvent,
        ],
        textNotifsEnabled: true,
        phoneNumber: '+15555550300',
        phoneNumberValidated: true,
        emailNotifsEnabled: false,
      }),
    );
    const cohortUserWithTags = await userRepo.findOneOrFail({
      where: { id: cohortUser.id },
      relations: { tags: true },
    });

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('group-cohort-action'),
      eventDate: new Date(now - 35 * 60 * 1000),
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.Tag,
      {
        userTag: tag,
        sendAtAbsolute: new Date(now - 6 * 60 * 1000),
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(cohortUserWithTags.id);

    await userRepo.delete({ id: cohortUser.id });
  });

  it('respects deadlines when scheduling reminders from a deadline offset', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(
      user.id,
      new Date(now - 5 * 24 * 60 * 60 * 1000),
    );

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

    await setUserContractSigned(
      user.id,
      new Date(now - 6 * 24 * 60 * 60 * 1000),
    );
    await userRepo.update(user.id, {
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

  it('aligns relative range reminders with deadline offsets', async () => {
    const now = Date.now();
    const sendTime = new Date(now - 5 * 60 * 1000);

    const user = await getPrimaryUser();
    const preferredTime = Temporal.Instant.from(sendTime.toISOString())
      .toZonedDateTimeISO('UTC')
      .toPlainTime();

    await setUserContractSigned(
      user.id,
      new Date(now - 7 * 24 * 60 * 60 * 1000),
    );
    await userRepo.update(user.id, {
      timeZone: 'UTC',
      preferredReminderTime: preferredTime,
    });

    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('relative-range-action'),
      eventDate: new Date(now - 6 * 60 * 60 * 1000),
    });

    const offsetSeconds = 2 * 60 * 60;

    const deadlineEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Relative deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(sendTime.getTime() + offsetSeconds * 1000),
        action,
      }),
    );

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.WithinRelativeRange,
      ReminderCohortType.AllUncompleted,
      {
        deadlineEvent,
        relative_range_start_seconds_from_deadline: offsetSeconds,
        relative_range_end_seconds_from_deadline: offsetSeconds,
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
    await clearUserContract(ctx.testUserId);

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
      relations: { actions: true },
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
          tags: [ctx.defaultTag],
          contractEvents: [
            {
              type: ContractEventType.SIGNED,
              date: new Date(now - 72 * 60 * 60 * 1000),
              automatic: false,
              contractId: ctx.defaultContractId,
            } as ContractEvent,
          ],
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
    await clearUserContract(ctx.testUserId);

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({
        name: uniqueName('suite-reminder-none'),
      }),
    );

    const newtag = tagRepo.create({
      name: uniqueName('suite-reminder-none-tag'),
      description: 'Suite reminder none tag',
    });
    const savedTag = await tagRepo.save(newtag);

    const eventDate = new Date(now - 45 * 60 * 1000);

    const { action: firstAction, memberEvent } =
      await createActionWithMemberEvent({
        name: uniqueName('suite-reminder-none-one'),
        eventDate,
        suite,
        suiteManaged: true,
      });

    const { action: secondAction } = await createActionWithMemberEvent({
      name: uniqueName('suite-reminder-none-two'),
      eventDate,
      suite,
      suiteManaged: true,
    });

    const suiteWithActions = await actionSuiteRepo.findOneOrFail({
      where: { id: suite.id },
      relations: { actions: true },
    });

    const completeUser = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('suite-complete')}@example.com`,
        password: 'pass',
        name: 'Suite Completer',
        tags: [savedTag],
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 6 * 24 * 60 * 60 * 1000),
            automatic: false,
            contractId: ctx.defaultContractId,
          } as ContractEvent,
        ],
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

  it('notifies group leaders about suite gaps and fills #{nmembers}', async () => {
    const now = Date.now();

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({
        name: uniqueName('leader-suite'),
      }),
    );

    const eventDate = new Date(now - 60 * 60 * 1000);

    const { action: firstAction, memberEvent } =
      await createActionWithMemberEvent({
        name: uniqueName('leader-suite-one'),
        eventDate,
        suite,
        suiteManaged: true,
      });

    const { action: secondAction } = await createActionWithMemberEvent({
      name: uniqueName('leader-suite-two'),
      eventDate,
      suite,
      suiteManaged: true,
    });

    const suiteWithActions = await actionSuiteRepo.findOneOrFail({
      where: { id: suite.id },
      relations: { actions: true },
    });

    const createSignedUser = async (
      label: string,
      phoneSuffix: string,
      overrides: Partial<User> = {},
    ) =>
      userRepo.save(
        userRepo.create({
          email: `${uniqueName(
            `leader-${label.toLowerCase().replace(/\s+/g, '-')}`,
          )}@example.com`,
          password: 'pass',
          name: label,
          tags: [ctx.defaultTag],
          contractEvents: [
            {
              type: ContractEventType.SIGNED,
              date: new Date(now - 7 * 24 * 60 * 60 * 1000),
              automatic: false,
              contractId: ctx.defaultContractId,
            } as ContractEvent,
          ],
          textNotifsEnabled: true,
          phoneNumber: `+1555555${phoneSuffix}`,
          phoneNumberValidated: true,
          emailNotifsEnabled: false,
          turnedOffAllNotifs: false,
          preferredActionReminderChannel: NotificationChannel.Text,
          ...overrides,
        }),
      );

    const leaderWithGaps = await createSignedUser('Lead With Gaps', '6101', {
      remindAboutUncompletedGroupMembers: true,
    });
    const leaderComplete = await createSignedUser('Lead Complete', '6102', {
      remindAboutUncompletedGroupMembers: true,
    });

    const communityWithGaps = await communityRepo.save(
      communityRepo.create({
        name: uniqueName('community-gaps'),
        description: 'Community with uncompleted members',
        leaders: [leaderWithGaps],
        users: [leaderWithGaps],
      }),
    );

    const communityComplete = await communityRepo.save(
      communityRepo.create({
        name: uniqueName('community-complete'),
        description: 'Community with completed members',
        leaders: [leaderComplete],
        users: [leaderComplete],
      }),
    );

    const memberWithOneCompletion = await createSignedUser(
      'Member One Completion',
      '6103',
      {
        communities: [communityWithGaps],
        textNotifsEnabled: false,
      },
    );

    const memberWithNoCompletion = await createSignedUser(
      'Member No Completion',
      '6104',
      {
        communities: [communityWithGaps],
        textNotifsEnabled: false,
      },
    );

    const completeMemberOne = await createSignedUser(
      'Member Complete One',
      '6105',
      {
        communities: [communityComplete],
        textNotifsEnabled: false,
      },
    );

    const completeMemberTwo = await createSignedUser(
      'Member Complete Two',
      '6106',
      {
        communities: [communityComplete],
        textNotifsEnabled: false,
      },
    );

    await recordCompletion(memberWithOneCompletion, firstAction);
    await recordCompletion(leaderWithGaps, firstAction);
    await recordCompletion(leaderWithGaps, secondAction);
    await recordCompletion(leaderComplete, firstAction);
    await recordCompletion(leaderComplete, secondAction);
    await recordCompletion(completeMemberOne, firstAction);
    await recordCompletion(completeMemberOne, secondAction);
    await recordCompletion(completeMemberTwo, firstAction);
    await recordCompletion(completeMemberTwo, secondAction);

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.GroupLeadsWithUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        actionSuite: suiteWithActions,
        textMessage: 'Leader reminder: #{nmembers} members need help.',
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    const notifiedIds = notifs.map((notif) => notif.user.id);

    expect(notifiedIds).toHaveLength(1);
    expect(notifiedIds).toContain(leaderWithGaps.id);
    expect(notifiedIds).not.toContain(leaderComplete.id);
    expect(notifs[0].channel).toBe(NotificationChannel.Text);

    const leaderWithGapsForText = await userRepo.findOneOrFail({
      where: { id: leaderWithGaps.id },
      loadRelationIds: { relations: ['leaderOf'] },
    });
    if (
      !leaderWithGapsForText.leaderOfIds ||
      leaderWithGapsForText.leaderOfIds.length === 0
    ) {
      leaderWithGapsForText.leaderOfIds = [communityWithGaps.id];
    }

    const leaderText = await worker.processCustomReminderText(
      reminderGroup.textMessage,
      {
        user: leaderWithGapsForText,
        group: reminderGroup,
        scheduledFor: new Date(),
      },
      'cid-group-leads',
    );

    expect(leaderText).toBe('Leader reminder: 2 members need help.');

    await userRepo.delete([
      leaderWithGaps.id,
      leaderComplete.id,
      memberWithOneCompletion.id,
      memberWithNoCompletion.id,
      completeMemberOne.id,
      completeMemberTwo.id,
    ]);
    await communityRepo.delete([communityWithGaps.id, communityComplete.id]);
  });

  it('excludes the leader from #{nmembers} counts', async () => {
    const now = Date.now();

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({
        name: uniqueName('leader-count-suite'),
      }),
    );

    const eventDate = new Date(now - 60 * 60 * 1000);

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('leader-count-action'),
      eventDate,
      suite,
      suiteManaged: true,
    });

    await createActionWithMemberEvent({
      name: uniqueName('leader-count-action-two'),
      eventDate,
      suite,
      suiteManaged: true,
    });

    const suiteWithActions = await actionSuiteRepo.findOneOrFail({
      where: { id: suite.id },
      relations: { actions: true },
    });

    const createSignedUser = async (
      label: string,
      phoneSuffix: string,
      overrides: Partial<User> = {},
    ) =>
      userRepo.save(
        userRepo.create({
          email: `${uniqueName(
            `leader-count-${label.toLowerCase().replace(/\s+/g, '-')}`,
          )}@example.com`,
          password: 'pass',
          name: label,
          tags: [ctx.defaultTag],
          contractEvents: [
            {
              type: ContractEventType.SIGNED,
              date: new Date(now - 7 * 24 * 60 * 60 * 1000),
              automatic: false,
              contractId: ctx.defaultContractId,
            } as ContractEvent,
          ],
          textNotifsEnabled: true,
          phoneNumber: `+1555555${phoneSuffix}`,
          phoneNumberValidated: true,
          emailNotifsEnabled: false,
          turnedOffAllNotifs: false,
          preferredActionReminderChannel: NotificationChannel.Text,
          ...overrides,
        }),
      );

    const leader = await createSignedUser('Leader Count', '6201', {
      remindAboutUncompletedGroupMembers: true,
    });
    const member = await createSignedUser('Member Count', '6202', {
      textNotifsEnabled: false,
    });

    const community = await communityRepo.save(
      communityRepo.create({
        name: uniqueName('community-leader-count'),
        description: 'Community for leader count',
        leaders: [leader],
        users: [leader, member],
      }),
    );

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.GroupLeadsWithUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        actionSuite: suiteWithActions,
        textMessage: 'Leaders need to help #{nmembers} members.',
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs.map((notif) => notif.user.id)).toEqual([leader.id]);

    const leaderForText = await userRepo.findOneOrFail({
      where: { id: leader.id },
      loadRelationIds: { relations: ['leaderOf'] },
    });
    if (!leaderForText.leaderOfIds || leaderForText.leaderOfIds.length === 0) {
      leaderForText.leaderOfIds = [community.id];
    }

    const leaderText = await worker.processCustomReminderText(
      reminderGroup.textMessage,
      {
        user: leaderForText,
        group: reminderGroup,
        scheduledFor: new Date(),
      },
      'cid-leader-count',
    );

    expect(leaderText).toBe('Leaders need to help 1 members.');

    await userRepo.update(leader.id, {
      remindAboutUncompletedGroupMembers: false,
    });

    const reminderGroupNoLeader = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.GroupLeadsWithUncompleted,
      {
        sendAtAbsolute: new Date(now - 4 * 60 * 1000),
        actionSuite: suiteWithActions,
        textMessage: 'Leaders need to help #{nmembers} members.',
      },
    );

    await worker.dispatchDueNotifs();

    const notifsWithoutLeader = await fetchNotifsForGroup(
      reminderGroupNoLeader,
    );
    expect(notifsWithoutLeader).toHaveLength(0);

    await userRepo.delete([leader.id, member.id]);
    await communityRepo.delete({ id: community.id });
  });

  it('uses suite-aware #{n} and #{tasktime} counts when configured', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({
        name: uniqueName('suite-count-primary'),
      }),
    );

    const otherSuite = await actionSuiteRepo.save(
      actionSuiteRepo.create({
        name: uniqueName('suite-count-secondary'),
      }),
    );

    const eventDate = new Date(now - 30 * 60 * 1000);

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('suite-count-one'),
      eventDate,
      suite,
      suiteManaged: true,
      timeEstimate: 7,
    });

    await createActionWithMemberEvent({
      name: uniqueName('suite-count-two'),
      eventDate,
      suite,
      suiteManaged: true,
      timeEstimate: 15,
    });

    await createActionWithMemberEvent({
      name: uniqueName('suite-count-other-suite'),
      eventDate,
      suite: otherSuite,
      suiteManaged: true,
      timeEstimate: 23,
    });

    const suiteWithActions = await actionSuiteRepo.findOneOrFail({
      where: { id: suite.id },
      relations: { actions: true },
    });

    const suiteReminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        actionSuite: suiteWithActions,
        useSuiteTaskCount: true,
        textMessage: 'Suite reminder #{n} with #{tasktime}',
        emailMessage: 'Suite reminder #{n}',
        emailSubject: 'Suite reminder #{n}',
      },
    );

    const suiteText = await worker.processCustomReminderText(
      suiteReminderGroup.textMessage,
      {
        user,
        group: suiteReminderGroup,
        scheduledFor: new Date(),
      },
      'cid-suite-count',
    );

    expect(suiteText).toBe('Suite reminder 2 with 22 minutes');

    const totalReminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 4 * 60 * 1000),
        actionSuite: suiteWithActions,
        useSuiteTaskCount: false,
        textMessage: 'Total reminder #{n}',
        emailMessage: 'Total reminder #{n}',
        emailSubject: 'Total reminder #{n}',
      },
    );

    const totalText = await worker.processCustomReminderText(
      totalReminderGroup.textMessage,
      {
        user,
        group: totalReminderGroup,
        scheduledFor: new Date(),
      },
      'cid-total-count',
    );

    expect(totalText).toBe('Total reminder 3');
  });

  it('replaces placeholders in custom reminder text', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));
    await userRepo.update(user.id, {
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

  // --- Cohort Expression Evaluation in Notification Pipeline ---

  const createActionWithCohortExpression = async ({
    name,
    eventDate,
    cohortExpression,
  }: {
    name: string;
    eventDate: Date;
    cohortExpression: Record<string, unknown>;
  }) => {
    const action = await actionRepo.save(
      actionRepo.create({
        name,
        category: 'Testing',
        body: 'Body copy',
        shortDescription: 'Short description',
        type: ActionTaskType.Activity,
        commitmentless: true,
        everyoneShouldComplete: true,
        cohortExpression,
      }),
    );

    const memberEvent = await eventRepo.save(
      eventRepo.create({
        title: `${name} member event`,
        description: 'desc',
        newStatus: ActionStatus.MemberAction,
        date: eventDate,
        action,
      }),
    );

    return { action, memberEvent };
  };

  it('excludes users not matching CompletedAction cohort from notifications', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 48 * 60 * 60 * 1000));

    // Create a prerequisite action and mark user as completed
    const prereqAction = await actionRepo.save(
      actionRepo.create({
        name: uniqueName('prereq'),
        category: 'Testing',
        body: 'Body',
        shortDescription: 'Short',
        type: ActionTaskType.Activity,
        commitmentless: true,
        everyoneShouldComplete: true,
      }),
    );
    await recordCompletion(user, prereqAction);

    // Create a second user who did NOT complete the prereq
    const nonCompleter = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('non-completer')}@example.com`,
        password: 'pass',
        name: 'Non Completer',
        tags: [ctx.defaultTag],
        textNotifsEnabled: true,
        phoneNumber: '+15555550200',
        phoneNumberValidated: true,
      }),
    );
    await setUserContractSigned(
      nonCompleter.id,
      new Date(now - 48 * 60 * 60 * 1000),
    );

    // Action with CompletedAction cohort: only users who completed prereq
    const { memberEvent } = await createActionWithCohortExpression({
      name: uniqueName('completed-action-cohort'),
      eventDate: new Date(now - 60 * 60 * 1000),
      cohortExpression: {
        type: 'CompletedAction',
        actionId: prereqAction.id,
      },
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      { sendAtAbsolute: new Date(now - 5 * 60 * 1000) },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    const notifiedUserIds = notifs.map((n) => n.user.id);

    expect(notifiedUserIds).toContain(user.id);
    expect(notifiedUserIds).not.toContain(nonCompleter.id);
  });

  it('excludes users not matching GroupLead cohort from notifications', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 48 * 60 * 60 * 1000));

    // Create a community and make user a leader
    const community = await communityRepo.save(
      communityRepo.create({
        name: uniqueName('leader-community'),
        leaders: [user],
        users: [user],
      }),
    );

    // Create a non-leader
    const nonLeader = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('non-leader')}@example.com`,
        password: 'pass',
        name: 'Non Leader',
        tags: [ctx.defaultTag],
        textNotifsEnabled: true,
        phoneNumber: '+15555550201',
        phoneNumberValidated: true,
      }),
    );
    await setUserContractSigned(
      nonLeader.id,
      new Date(now - 48 * 60 * 60 * 1000),
    );
    community.users = [...(community.users ?? []), nonLeader];
    await communityRepo.save(community);

    const { memberEvent } = await createActionWithCohortExpression({
      name: uniqueName('group-lead-cohort'),
      eventDate: new Date(now - 60 * 60 * 1000),
      cohortExpression: { type: 'GroupLead' },
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      { sendAtAbsolute: new Date(now - 5 * 60 * 1000) },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    const notifiedUserIds = notifs.map((n) => n.user.id);

    expect(notifiedUserIds).toContain(user.id);
    expect(notifiedUserIds).not.toContain(nonLeader.id);
  });

  it('excludes users not matching FormFieldValue cohort from notifications', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 48 * 60 * 60 * 1000));

    const form = await formRepo.save(
      formRepo.create({
        title: 'Cohort Form',
        schema: {
          title: 'Cohort Form',
          pages: [
            {
              id: 'page-1',
              fields: [{ id: 'field-1', kind: 'text', label: 'Answer' }],
            },
          ],
          outputViews: [],
        } as unknown as Record<string, unknown>,
      }),
    );

    // User submitted a form response
    await formResponseRepo.save(
      formResponseRepo.create({
        formId: form.id,
        form,
        answers: { 'field-1': 'yes' },
        schemaSnapshot: form.schema as Record<string, unknown>,
        user,
      }),
    );

    // Non-responder user
    const nonResponder = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('non-responder')}@example.com`,
        password: 'pass',
        name: 'Non Responder',
        tags: [ctx.defaultTag],
        textNotifsEnabled: true,
        phoneNumber: '+15555550202',
        phoneNumberValidated: true,
      }),
    );
    await setUserContractSigned(
      nonResponder.id,
      new Date(now - 48 * 60 * 60 * 1000),
    );

    const { memberEvent } = await createActionWithCohortExpression({
      name: uniqueName('form-field-cohort'),
      eventDate: new Date(now - 60 * 60 * 1000),
      cohortExpression: {
        type: 'FormFieldValue',
        formId: form.id,
        fieldId: 'field-1',
        responseAny: true,
      },
    });

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      { sendAtAbsolute: new Date(now - 5 * 60 * 1000) },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    const notifiedUserIds = notifs.map((n) => n.user.id);

    expect(notifiedUserIds).toContain(user.id);
    expect(notifiedUserIds).not.toContain(nonResponder.id);
  });
});
