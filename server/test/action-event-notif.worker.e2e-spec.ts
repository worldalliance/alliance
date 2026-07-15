import { ActionActivityType } from '@alliance/common/actionActivity';
import { Temporal } from '@js-temporal/polyfill';
import { ActionsService } from 'src/actions/actions.service';
import { CreateReminderGroupDto } from 'src/actions/dto/action.dto';
import { ActionActivity } from 'src/actions/entities/action-activity.entity';
import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import { ActionFormVariant } from 'src/actions/entities/action-form-variant.entity';
import { ActionSuite } from 'src/actions/entities/action-suite.entity';
import { Action, ActionTaskType } from 'src/actions/entities/action.entity';
import {
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from 'src/actions/entities/reminder-group.entity';
import { Community } from 'src/community/entities/community.entity';
import { ActionEventNotifWorker } from 'src/notifs/action-event-notif.worker';
import { ActionEventReminderService } from 'src/notifs/action-event-reminder.service';
import { ActionEventNotif } from 'src/notifs/entities/action-event-notif.entity';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import {
  ContractEvent,
  ContractEventType,
} from 'src/user/entities/contract-event.entity';
import { Tag } from 'src/user/entities/tag.entity';
import {
  UserAwayRange,
  UserAwayRangeReason,
} from 'src/user/entities/user-away-range.entity';
import { User } from 'src/user/entities/user.entity';
import type { Repository } from 'typeorm';
import {
  createFormWithSnapshot,
  createTestApp,
  TestContext,
} from './e2e-test-utils';

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
  let awayRangeRepo: Repository<UserAwayRange>;

  const baseMessages = {
    emailMessage: 'Reminder for #{firstname} on #{action}',
    emailSubject: 'Reminder: #{action}',
    textMessage: 'Hi #{firstname}, remember #{action}',
  };

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = '1';
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
    awayRangeRepo = ctx.dataSource.getRepository(UserAwayRange);
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
      emailNotifsForActions: false,
      textNotifsForActions: true,
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
      relations: {
        user: true,
        reminderGroup: true,
        pushes: true,
        mms: true,
        mail: true,
      },
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

    expect(notifs[0].mms).toBeTruthy();
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
    expect(notifs[0].mms).toBeTruthy();
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

  it('sends reminders to eligible users who have not completed the action', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(
      user.id,
      new Date(now - 5 * 24 * 60 * 60 * 1000),
    );

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('uncompleted-action'),
      eventDate: new Date(now - 50 * 60 * 1000),
    });

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
        textNotifsForActions: true,
        phoneNumber: '+15555550201',
        phoneNumberValidated: true,
        emailNotifsForActions: false,
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

  it('excludes users away during the member-action window, even if back at send time', async () => {
    const now = Date.now();
    const primaryUser = await getPrimaryUser();

    // Away for a stretch mid-phase, but present again by the time the
    // reminder is sent. The roster/pill treat window-overlap away as "not
    // required", so the reminder must too — the send-time isUserIdAway check
    // alone would let this user through.
    const awayUser = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('custom-away')}@example.com`,
        password: 'pass',
        name: 'Away Custom User',
        tags: primaryUser.tags,
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 7 * 24 * 60 * 60 * 1000),
            automatic: false,
            contractId: ctx.defaultContractId,
          } as ContractEvent,
        ],
        textNotifsForActions: true,
        phoneNumber: '+15555550202',
        phoneNumberValidated: true,
        emailNotifsForActions: false,
      }),
    );
    await awayRangeRepo.save(
      awayRangeRepo.create({
        userId: awayUser.id,
        startDate: new Date(now - 90 * 60 * 1000), // away 90min ago...
        endDate: new Date(now - 30 * 60 * 1000), // ...until 30min ago
        reason: UserAwayRangeReason.VACATION,
      }),
    );
    const awayUserWithTags = await userRepo.findOneOrFail({
      where: { id: awayUser.id },
      relations: { tags: true },
    });

    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('custom-cohort-away-mid-phase'),
      eventDate: new Date(now - 2 * 60 * 60 * 1000), // phase started 2 hours ago
    });
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
        users: [awayUserWithTags],
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        deadlineEvent,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(0);

    await userRepo.delete({ id: awayUser.id });
  });

  it('sends reminders to users whose away range misses the member-action window', async () => {
    const now = Date.now();
    const primaryUser = await getPrimaryUser();

    // Positive control for the window-overlap exclusion: away well before the
    // phase started, present throughout it — must still be reminded.
    const previouslyAwayUser = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('custom-was-away')}@example.com`,
        password: 'pass',
        name: 'Previously Away Custom User',
        tags: primaryUser.tags,
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 7 * 24 * 60 * 60 * 1000),
            automatic: false,
            contractId: ctx.defaultContractId,
          } as ContractEvent,
        ],
        textNotifsForActions: true,
        phoneNumber: '+15555550203',
        phoneNumberValidated: true,
        emailNotifsForActions: false,
      }),
    );
    await awayRangeRepo.save(
      awayRangeRepo.create({
        userId: previouslyAwayUser.id,
        startDate: new Date(now - 5 * 24 * 60 * 60 * 1000), // away 5 days ago...
        endDate: new Date(now - 4 * 24 * 60 * 60 * 1000), // ...until 4 days ago
        reason: UserAwayRangeReason.VACATION,
      }),
    );
    const userWithTags = await userRepo.findOneOrFail({
      where: { id: previouslyAwayUser.id },
      relations: { tags: true },
    });

    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('custom-cohort-away-before-phase'),
      eventDate: new Date(now - 2 * 60 * 60 * 1000),
    });
    const deadlineEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 60 * 60 * 1000),
        action,
      }),
    );

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.Custom,
      {
        users: [userWithTags],
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        deadlineEvent,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(previouslyAwayUser.id);

    await userRepo.delete({ id: previouslyAwayUser.id });
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
        textNotifsForActions: true,
        phoneNumber: '+15555550200',
        phoneNumberValidated: true,
        emailNotifsForActions: false,
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
        textNotifsForActions: true,
        phoneNumber: '+15555550300',
        phoneNumberValidated: true,
        emailNotifsForActions: false,
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
    expect(notifs[0].mms).toBeTruthy();
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
    expect(notifs[0].mms).toBeTruthy();
  });

  it('sends at a dependency action deadline when timingAnchorEvent is set, even with the own deadline far away', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(
      user.id,
      new Date(now - 5 * 24 * 60 * 60 * 1000),
    );

    // dependency action A whose deadline just passed
    const { action: dependencyAction } = await createActionWithMemberEvent({
      name: uniqueName('dependency-action'),
      eventDate: new Date(now - 3 * 24 * 60 * 60 * 1000),
    });
    const dependencyDeadline = await eventRepo.save(
      eventRepo.create({
        title: 'Dependency deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now - 5 * 60 * 1000),
        action: dependencyAction,
      }),
    );

    // action B with its own deadline far outside the send window
    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('anchored-action'),
      eventDate: new Date(now - 2 * 60 * 60 * 1000),
    });
    const ownDeadline = await eventRepo.save(
      eventRepo.create({
        title: 'Own deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 10 * 24 * 60 * 60 * 1000),
        action,
      }),
    );

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.FromDeadline,
      ReminderCohortType.AllUncompleted,
      {
        deadlineEvent: ownDeadline,
        timingAnchorEvent: dependencyDeadline,
        sendAtSecondsFromDeadline: 0,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(user.id);
  });

  it('anchors relative range windows to timingAnchorEvent when set', async () => {
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

    const { action: dependencyAction } = await createActionWithMemberEvent({
      name: uniqueName('anchor-range-dependency'),
      eventDate: new Date(now - 3 * 24 * 60 * 60 * 1000),
    });

    const offsetSeconds = 2 * 60 * 60;
    const anchorEvent = await eventRepo.save(
      eventRepo.create({
        title: 'Anchor deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(sendTime.getTime() + offsetSeconds * 1000),
        action: dependencyAction,
      }),
    );

    const { action, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('anchor-range-action'),
      eventDate: new Date(now - 6 * 60 * 60 * 1000),
    });
    const ownDeadline = await eventRepo.save(
      eventRepo.create({
        title: 'Own faraway deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 10 * 24 * 60 * 60 * 1000),
        action,
      }),
    );

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.WithinRelativeRange,
      ReminderCohortType.AllUncompleted,
      {
        deadlineEvent: ownDeadline,
        timingAnchorEvent: anchorEvent,
        relative_range_start_seconds_from_deadline: offsetSeconds,
        relative_range_end_seconds_from_deadline: offsetSeconds,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(user.id);
  });

  it('skips users already notified via any sibling group when excludePreviouslyNotified is set', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('exclude-notified-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });

    // sibling group that already notified the user (outside the send window)
    const siblingGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 24 * 60 * 60 * 1000),
        allSent: true,
      },
    );
    await notifRepo.save(
      notifRepo.create({
        user,
        reminderGroup: siblingGroup,
        memberActionEvent: memberEvent,
        sent: true,
        idempotency_key: `reminder:${siblingGroup.id}:${user.id}`,
      }),
    );

    const catchUpGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        excludePreviouslyNotified: true,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(catchUpGroup);
    expect(notifs).toHaveLength(0);
  });

  it('still skips previously notified users after the notifying group is deleted', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('deleted-group-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });

    const siblingGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 24 * 60 * 60 * 1000),
        allSent: true,
      },
    );
    await notifRepo.save(
      notifRepo.create({
        user,
        reminderGroup: siblingGroup,
        memberActionEvent: memberEvent,
        sent: true,
        idempotency_key: `reminder:${siblingGroup.id}:${user.id}`,
      }),
    );
    // deleting the group orphans the notif's reminderGroup FK (SET NULL); the
    // denormalized memberActionEvent must keep the user excluded
    await reminderGroupRepo.delete(siblingGroup.id);

    const catchUpGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        excludePreviouslyNotified: true,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(catchUpGroup);
    expect(notifs).toHaveLength(0);
  });

  it('skips the catch-up when a sibling group sends in the same dispatch cycle', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('same-cycle-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });

    // both groups fall due in the same dispatch window; no notif exists yet
    const siblingGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      { sendAtAbsolute: new Date(now - 10 * 60 * 1000) },
    );
    const catchUpGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        excludePreviouslyNotified: true,
      },
    );

    await worker.dispatchDueNotifs();

    const siblingNotifs = await fetchNotifsForGroup(siblingGroup);
    expect(siblingNotifs).toHaveLength(1);
    expect(siblingNotifs[0].user.id).toBe(user.id);
    const catchUpNotifs = await fetchNotifsForGroup(catchUpGroup);
    expect(catchUpNotifs).toHaveLength(0);
  });

  it('dispatches the sibling before the catch-up when both are due at the same instant', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('same-instant-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });

    // identical send times, catch-up created first (lower id) so that without
    // the deterministic tie-break it would be dispatched first and double-send
    const sendAt = new Date(now - 5 * 60 * 1000);
    const catchUpGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: sendAt,
        excludePreviouslyNotified: true,
      },
    );
    const siblingGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      { sendAtAbsolute: sendAt },
    );

    await worker.dispatchDueNotifs();

    const siblingNotifs = await fetchNotifsForGroup(siblingGroup);
    expect(siblingNotifs).toHaveLength(1);
    expect(siblingNotifs[0].user.id).toBe(user.id);
    const catchUpNotifs = await fetchNotifsForGroup(catchUpGroup);
    expect(catchUpNotifs).toHaveLength(0);
  });

  it('still sends the catch-up when the sibling plan in the same cycle never actually sent', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('failed-sibling-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });

    // sibling is due in the same window, but a previous attempt already
    // created its notif row without sending (sent = false); its idempotency
    // key makes every retry skip, so it must not suppress the catch-up
    const siblingGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      { sendAtAbsolute: new Date(now - 10 * 60 * 1000) },
    );
    await notifRepo.save(
      notifRepo.create({
        user,
        reminderGroup: siblingGroup,
        memberActionEvent: memberEvent,
        sent: false,
        idempotency_key: `reminder:${siblingGroup.id}:${user.id}`,
      }),
    );

    const catchUpGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        excludePreviouslyNotified: true,
      },
    );

    await worker.dispatchDueNotifs();

    const catchUpNotifs = await fetchNotifsForGroup(catchUpGroup);
    expect(catchUpNotifs).toHaveLength(1);
    expect(catchUpNotifs[0].user.id).toBe(user.id);
  });

  it('does not count a group-leads nudge as personally notifying the leader', async () => {
    const now = Date.now();

    const createSignedUser = async (
      label: string,
      phoneSuffix: string,
      overrides: Partial<User> = {},
    ) =>
      userRepo.save(
        userRepo.create({
          email: `${uniqueName(
            `catchup-${label.toLowerCase().replace(/\s+/g, '-')}`,
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
          textNotifsForActions: true,
          phoneNumber: `+1555555${phoneSuffix}`,
          phoneNumberValidated: true,
          emailNotifsForActions: false,
          turnedOffAllNotifs: false,
          ...overrides,
        }),
      );

    const leader = await createSignedUser('Leader Also Member', '6301', {
      remindAboutUncompletedGroupMembers: true,
    });
    const member = await createSignedUser('Member Behind', '6302', {
      textNotifsForActions: false,
    });
    const community = await communityRepo.save(
      communityRepo.create({
        name: uniqueName('community-catch-up'),
        description: 'Community for catch-up exclusion',
        leaders: [leader],
        users: [leader, member],
      }),
    );

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('group-leads-catch-up-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });

    const groupLeadsGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.GroupLeadsWithUncompleted,
      { sendAtAbsolute: new Date(now - 10 * 60 * 1000) },
    );
    const catchUpGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        excludePreviouslyNotified: true,
      },
    );

    await worker.dispatchDueNotifs();

    // the leader got the nudge, but it carries no event stamp...
    const nudgeNotif = await notifRepo.findOneOrFail({
      where: { reminderGroup: { id: groupLeadsGroup.id } },
      relations: { user: true, memberActionEvent: true },
    });
    expect(nudgeNotif.user.id).toBe(leader.id);
    expect(nudgeNotif.memberActionEvent ?? null).toBeNull();

    // ...so the leader still gets their own catch-up notification
    const catchUpNotifs = await fetchNotifsForGroup(catchUpGroup);
    expect(catchUpNotifs.map((notif) => notif.user.id)).toContain(leader.id);

    await userRepo.delete([leader.id, member.id]);
    await communityRepo.delete([community.id]);
  });

  it('still sends when the prior sent notif belongs to a different event and excludePreviouslyNotified is set', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const { memberEvent: otherEvent } = await createActionWithMemberEvent({
      name: uniqueName('other-event-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });
    const otherGroup = await createReminderGroup(
      otherEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 24 * 60 * 60 * 1000),
        allSent: true,
      },
    );
    await notifRepo.save(
      notifRepo.create({
        user,
        reminderGroup: otherGroup,
        memberActionEvent: otherEvent,
        sent: true,
        idempotency_key: `reminder:${otherGroup.id}:${user.id}`,
      }),
    );

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('unrelated-notified-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });
    const catchUpGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        excludePreviouslyNotified: true,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(catchUpGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(user.id);
  });

  it('does not skip sibling-group-notified users when excludePreviouslyNotified is false', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const { memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('flag-off-action'),
      eventDate: new Date(now - 60 * 60 * 1000),
    });

    const siblingGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 24 * 60 * 60 * 1000),
        allSent: true,
      },
    );
    await notifRepo.save(
      notifRepo.create({
        user,
        reminderGroup: siblingGroup,
        memberActionEvent: memberEvent,
        sent: true,
        idempotency_key: `reminder:${siblingGroup.id}:${user.id}`,
      }),
    );

    const secondGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        excludePreviouslyNotified: false,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(secondGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(user.id);
  });

  it('derives reminder anchor candidates from form-response and completed-action cohort conditions', async () => {
    const now = Date.now();
    const actionsService = ctx.app.get(ActionsService);

    // dependency A: owns the form (taskFormId) and has a deadline
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: uniqueName('dependency-form'),
      schema: { fields: [] },
    });
    const { action: formAction } = await createActionWithMemberEvent({
      name: uniqueName('form-owner-action'),
      eventDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });
    await actionRepo.update(formAction.id, { taskFormId: form.id });
    const formActionDeadline = await eventRepo.save(
      eventRepo.create({
        title: 'Form action deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 24 * 60 * 60 * 1000),
        action: formAction,
      }),
    );

    // dependency B: referenced via CompletedAction, has a deadline
    const { action: completedDep } = await createActionWithMemberEvent({
      name: uniqueName('completed-dependency'),
      eventDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });
    const completedDepDeadline = await eventRepo.save(
      eventRepo.create({
        title: 'Completed dependency deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 2 * 24 * 60 * 60 * 1000),
        action: completedDep,
      }),
    );

    // dependency C: referenced but has no deadline event → dropped
    const { action: noDeadlineDep } = await createActionWithMemberEvent({
      name: uniqueName('no-deadline-dependency'),
      eventDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });

    // dependency D: owns its form via an action_form_variant, has a deadline
    const { form: variantForm } = await createFormWithSnapshot(ctx.dataSource, {
      title: uniqueName('variant-form'),
      schema: { fields: [] },
    });
    const { action: variantAction } = await createActionWithMemberEvent({
      name: uniqueName('variant-owner-action'),
      eventDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });
    const variantRepo = ctx.dataSource.getRepository(ActionFormVariant);
    await variantRepo.save(
      variantRepo.create({
        actionId: variantAction.id,
        formId: variantForm.id,
        name: 'Variant A',
        splitValue: 0.5,
      }),
    );
    const variantActionDeadline = await eventRepo.save(
      eventRepo.create({
        title: 'Variant action deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 3 * 24 * 60 * 60 * 1000),
        action: variantAction,
      }),
    );

    const { action: dependentAction, memberEvent } =
      await createActionWithMemberEvent({
        name: uniqueName('dependent-action'),
        eventDate: new Date(now - 60 * 60 * 1000),
      });
    await actionRepo.update(dependentAction.id, {
      cohortExpression: {
        op: 'AND',
        children: [
          { type: 'FormFieldValue', formId: form.id, fieldId: 'q1' },
          { type: 'FormFieldValue', formId: variantForm.id, fieldId: 'q1' },
          { type: 'CompletedAction', actionId: completedDep.id },
          { type: 'CompletedAction', actionId: noDeadlineDep.id },
        ],
      },
    });

    const candidates = await actionsService.findReminderAnchorCandidates(
      memberEvent.id,
    );

    const byActionId = new Map(candidates.map((c) => [c.actionId, c]));
    expect(byActionId.size).toBe(3);
    expect(byActionId.get(formAction.id)?.deadlineEventId).toBe(
      formActionDeadline.id,
    );
    expect(byActionId.get(variantAction.id)?.deadlineEventId).toBe(
      variantActionDeadline.id,
    );
    expect(byActionId.get(completedDep.id)?.deadlineEventId).toBe(
      completedDepDeadline.id,
    );
    expect(byActionId.has(noDeadlineDep.id)).toBe(false);
    expect(byActionId.has(dependentAction.id)).toBe(false);
  });

  it('only accepts a timing anchor that is a dependency deadline of the action', async () => {
    const now = Date.now();
    const reminderService = ctx.app.get(ActionEventReminderService);

    const { action: dependencyAction } = await createActionWithMemberEvent({
      name: uniqueName('anchor-validate-dependency'),
      eventDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });
    const dependencyDeadline = await eventRepo.save(
      eventRepo.create({
        title: 'Dependency deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 24 * 60 * 60 * 1000),
        action: dependencyAction,
      }),
    );

    // real deadline event, but of an action the cohort doesn't depend on
    const { action: unrelatedAction } = await createActionWithMemberEvent({
      name: uniqueName('anchor-validate-unrelated'),
      eventDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });
    const unrelatedDeadline = await eventRepo.save(
      eventRepo.create({
        title: 'Unrelated deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 24 * 60 * 60 * 1000),
        action: unrelatedAction,
      }),
    );

    const { action: dependentAction, memberEvent } =
      await createActionWithMemberEvent({
        name: uniqueName('anchor-validate-action'),
        eventDate: new Date(now - 60 * 60 * 1000),
      });
    await actionRepo.update(dependentAction.id, {
      cohortExpression: {
        type: 'CompletedAction',
        actionId: dependencyAction.id,
      },
    });

    const baseDto = {
      name: 'Anchor validation group',
      timingMode: ReminderGroupTimingMode.FromDeadline,
      cohortType: ReminderCohortType.AllUncompleted,
      sendAtSecondsFromDeadline: 0,
      emailMessage: 'msg',
      emailSubject: 'subject',
      textMessage: 'text',
      pushMessage: 'push',
      useSuiteTaskCount: false,
      excludeOptionalActions: false,
      excludePreviouslyNotified: true,
    };

    await expect(
      reminderService.createReminderGroup(memberEvent.id, {
        ...baseDto,
        timingAnchorEventId: unrelatedDeadline.id,
      } as CreateReminderGroupDto),
    ).rejects.toThrow(
      'Timing anchor event must be the deadline of a cohort dependency of the action or its suite',
    );

    const created = await reminderService.createReminderGroup(memberEvent.id, {
      ...baseDto,
      timingAnchorEventId: dependencyDeadline.id,
    } as CreateReminderGroupDto);
    expect(created.timingAnchorEvent?.id).toBe(dependencyDeadline.id);

    // updating without timingAnchorEventId clears the anchor in the database
    await reminderService.updateReminderGroup(created.id, {
      ...baseDto,
    } as CreateReminderGroupDto);
    const reloaded = await reminderGroupRepo.findOneOrFail({
      where: { id: created.id },
      relations: { timingAnchorEvent: true },
    });
    expect(reloaded.timingAnchorEvent).toBeNull();
  });

  it('only notifies about the suite tasks the user has not been notified about yet', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({ name: uniqueName('catch-up-suite') }),
    );
    const eventDate = new Date(now - 60 * 60 * 1000);
    const { action: actionA, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('catch-up-task-a'),
      eventDate,
      suite,
      suiteManaged: true,
    });
    const { action: actionB } = await createActionWithMemberEvent({
      name: uniqueName('catch-up-task-b'),
      eventDate,
      suite,
      suiteManaged: true,
    });
    const { action: actionC } = await createActionWithMemberEvent({
      name: uniqueName('catch-up-task-c'),
      eventDate,
      suite,
      suiteManaged: true,
    });
    const suiteWithActions = await actionSuiteRepo.findOneOrFail({
      where: { id: suite.id },
      relations: { actions: true },
    });

    // the launch announcement covered tasks a and b only (the user joined
    // c's cohort after it went out)
    const launchGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 24 * 60 * 60 * 1000),
        allSent: true,
        actionSuite: suiteWithActions,
      },
    );
    await notifRepo.save(
      notifRepo.create({
        user,
        reminderGroup: launchGroup,
        memberActionEvent: memberEvent,
        notifiedActionIds: [actionA.id, actionB.id],
        sent: true,
        idempotency_key: `reminder:${launchGroup.id}:${user.id}`,
      }),
    );

    const catchUpGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        actionSuite: suiteWithActions,
        useSuiteTaskCount: true,
        excludePreviouslyNotified: true,
      },
    );

    await worker.dispatchDueNotifs();

    // the user is notified (c is news to them), but the message only covers c
    const notifs = await fetchNotifsForGroup(catchUpGroup);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user.id).toBe(user.id);
    expect(notifs[0].notifiedActionIds).toEqual([actionC.id]);
  });

  it('previews a suite catch-up with the full suite scope, not just the member action', async () => {
    const now = Date.now();
    const actionsService = ctx.app.get(ActionsService);
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({ name: uniqueName('preview-scope-suite') }),
    );
    const eventDate = new Date(now - 60 * 60 * 1000);
    const { action: actionA, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('preview-scope-task-a'),
      eventDate,
      suite,
      suiteManaged: true,
    });
    const { action: actionB } = await createActionWithMemberEvent({
      name: uniqueName('preview-scope-task-b'),
      eventDate,
      suite,
      suiteManaged: true,
    });

    // launch covered the member action only; b is still news to the user, so
    // a suite-scoped catch-up preview must list them (a member-action-only
    // scope would treat them as fully notified and show no recipients)
    const launchGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 24 * 60 * 60 * 1000),
        allSent: true,
      },
    );
    const launchNotif = await notifRepo.save(
      notifRepo.create({
        user,
        reminderGroup: launchGroup,
        memberActionEvent: memberEvent,
        notifiedActionIds: [actionA.id],
        sent: true,
        idempotency_key: `reminder:${launchGroup.id}:${user.id}`,
      }),
    );

    const catchUpDto = {
      name: 'Tentative suite catch-up',
      timingMode: ReminderGroupTimingMode.Absolute,
      sendAtAbsolute: new Date(now - 5 * 60 * 1000),
      cohortType: ReminderCohortType.AllUncompleted,
      emailMessage: 'msg',
      emailSubject: 'subject',
      textMessage: 'text',
      pushMessage: 'push',
      suiteId: suite.id,
      useSuiteTaskCount: true,
      excludeOptionalActions: false,
      excludePreviouslyNotified: true,
    } as CreateReminderGroupDto;

    const plans = await actionsService.tentativePlansForGroup(
      memberEvent.id,
      catchUpDto,
    );
    expect(plans.map((plan) => plan.user.id)).toContain(user.id);

    // once the whole suite scope is covered, the same preview excludes them
    await notifRepo.update(launchNotif.id, {
      notifiedActionIds: [actionA.id, actionB.id],
    });
    const plansAfterFullCoverage = await actionsService.tentativePlansForGroup(
      memberEvent.id,
      catchUpDto,
    );
    expect(plansAfterFullCoverage.map((plan) => plan.user.id)).not.toContain(
      user.id,
    );
  });

  it('records only in-scope tasks, so a targeted reminder does not suppress a later catch-up', async () => {
    const now = Date.now();
    const user = await getPrimaryUser();
    await setUserContractSigned(user.id, new Date(now - 24 * 60 * 60 * 1000));

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({ name: uniqueName('scope-suite') }),
    );
    const eventDate = new Date(now - 60 * 60 * 1000);
    const { action: actionA, memberEvent } = await createActionWithMemberEvent({
      name: uniqueName('scope-task-a'),
      eventDate,
      suite,
      suiteManaged: true,
    });
    const { action: actionB } = await createActionWithMemberEvent({
      name: uniqueName('scope-task-b'),
      eventDate,
      suite,
      suiteManaged: true,
    });
    // uncompleted task outside the suite: it is on the user's global task
    // list, but never in scope for groups on this event
    await createActionWithMemberEvent({
      name: uniqueName('scope-unrelated'),
      eventDate,
    });
    const suiteWithActions = await actionSuiteRepo.findOneOrFail({
      where: { id: suite.id },
      relations: { actions: true },
    });

    // targeted reminder about this action only: without the suite task count
    // its task list is the user's global one (a, b, and the unrelated task),
    // but its covered-task record must stay within its single-action scope
    const targetedGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 10 * 60 * 1000),
        useSuiteTaskCount: false,
      },
    );
    const catchUpGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        actionSuite: suiteWithActions,
        useSuiteTaskCount: true,
        excludePreviouslyNotified: true,
      },
    );

    await worker.dispatchDueNotifs();

    const targetedNotifs = await fetchNotifsForGroup(targetedGroup);
    expect(targetedNotifs).toHaveLength(1);
    expect(targetedNotifs[0].notifiedActionIds).toEqual([actionA.id]);

    // b was never mentioned by the targeted reminder, so the catch-up in the
    // same cycle still fires for it (and covers only b)
    const catchUpNotifs = await fetchNotifsForGroup(catchUpGroup);
    expect(catchUpNotifs).toHaveLength(1);
    expect(catchUpNotifs[0].user.id).toBe(user.id);
    expect(catchUpNotifs[0].notifiedActionIds).toEqual([actionB.id]);
  });

  it('derives anchor candidates from every suite action and never from actions inside the suite', async () => {
    const now = Date.now();
    const actionsService = ctx.app.get(ActionsService);

    // external dependency with a deadline
    const { action: externalDep } = await createActionWithMemberEvent({
      name: uniqueName('suite-external-dep'),
      eventDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });
    const externalDepDeadline = await eventRepo.save(
      eventRepo.create({
        title: 'External dependency deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 24 * 60 * 60 * 1000),
        action: externalDep,
      }),
    );

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({ name: uniqueName('anchor-suite') }),
    );
    const eventDate = new Date(now - 60 * 60 * 1000);
    const { action: firstAction, memberEvent } =
      await createActionWithMemberEvent({
        name: uniqueName('anchor-suite-first'),
        eventDate,
        suite,
        suiteManaged: true,
      });
    const { action: secondAction } = await createActionWithMemberEvent({
      name: uniqueName('anchor-suite-second'),
      eventDate,
      suite,
      suiteManaged: true,
    });
    // give the in-suite dependency a deadline so its exclusion is meaningful
    await eventRepo.save(
      eventRepo.create({
        title: 'First action deadline',
        description: 'desc',
        newStatus: ActionStatus.Resolution,
        date: new Date(now + 24 * 60 * 60 * 1000),
        action: firstAction,
      }),
    );
    // only the *sibling* suite action references the dependencies; the tab's
    // own action keeps its plain tag cohort
    await actionRepo.update(secondAction.id, {
      cohortExpression: {
        op: 'AND',
        children: [
          { type: 'CompletedAction', actionId: externalDep.id },
          { type: 'CompletedAction', actionId: firstAction.id },
        ],
      },
    });

    const candidates = await actionsService.findReminderAnchorCandidates(
      memberEvent.id,
    );

    const candidateActionIds = candidates.map(
      (candidate) => candidate.actionId,
    );
    expect(candidateActionIds).toContain(externalDep.id);
    expect(candidateActionIds).not.toContain(firstAction.id);
    expect(candidateActionIds).not.toContain(secondAction.id);
    expect(
      candidates.find((candidate) => candidate.actionId === externalDep.id)
        ?.deadlineEventId,
    ).toBe(externalDepDeadline.id);
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
          textNotifsForActions: true,
          phoneNumber: `+1555555${phoneSuffix}`,
          phoneNumberValidated: true,
          emailNotifsForActions: false,
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
        textNotifsForActions: true,
        phoneNumber: '+15555552005',
        phoneNumberValidated: true,
        emailNotifsForActions: false,
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
          textNotifsForActions: true,
          phoneNumber: `+1555555${phoneSuffix}`,
          phoneNumberValidated: true,
          emailNotifsForActions: false,
          turnedOffAllNotifs: false,
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
        textNotifsForActions: false,
      },
    );

    const memberWithNoCompletion = await createSignedUser(
      'Member No Completion',
      '6104',
      {
        communities: [communityWithGaps],
        textNotifsForActions: false,
      },
    );

    const completeMemberOne = await createSignedUser(
      'Member Complete One',
      '6105',
      {
        communities: [communityComplete],
        textNotifsForActions: false,
      },
    );

    const completeMemberTwo = await createSignedUser(
      'Member Complete Two',
      '6106',
      {
        communities: [communityComplete],
        textNotifsForActions: false,
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
    expect(notifs[0].mms).toBeTruthy();

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

    const leaderPlan = {
      user: leaderWithGapsForText,
      group: reminderGroup,
      scheduledFor: new Date(),
    };
    const leaderTasks = await worker.findUncompletedTasksForPlan(leaderPlan);
    const leaderText = await worker.processCustomReminderText(
      reminderGroup.textMessage,
      leaderPlan,
      'cid-group-leads',
      leaderTasks,
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
          textNotifsForActions: true,
          phoneNumber: `+1555555${phoneSuffix}`,
          phoneNumberValidated: true,
          emailNotifsForActions: false,
          turnedOffAllNotifs: false,
          ...overrides,
        }),
      );

    const leader = await createSignedUser('Leader Count', '6201', {
      remindAboutUncompletedGroupMembers: true,
    });
    const member = await createSignedUser('Member Count', '6202', {
      textNotifsForActions: false,
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

    const leaderPlan2 = {
      user: leaderForText,
      group: reminderGroup,
      scheduledFor: new Date(),
    };
    const leaderTasks2 = await worker.findUncompletedTasksForPlan(leaderPlan2);
    const leaderText = await worker.processCustomReminderText(
      reminderGroup.textMessage,
      leaderPlan2,
      'cid-leader-count',
      leaderTasks2,
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

    const suitePlan = {
      user,
      group: suiteReminderGroup,
      scheduledFor: new Date(),
    };
    const suiteTasks = await worker.findUncompletedTasksForPlan(suitePlan);
    const suiteText = await worker.processCustomReminderText(
      suiteReminderGroup.textMessage,
      suitePlan,
      'cid-suite-count',
      suiteTasks,
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

    const totalPlan = {
      user,
      group: totalReminderGroup,
      scheduledFor: new Date(),
    };
    const totalTasks = await worker.findUncompletedTasksForPlan(totalPlan);
    const totalText = await worker.processCustomReminderText(
      totalReminderGroup.textMessage,
      totalPlan,
      'cid-total-count',
      totalTasks,
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

    const templatePlan = {
      user,
      group: reminderGroup,
      scheduledFor: new Date(),
    };
    const templateTasks =
      await worker.findUncompletedTasksForPlan(templatePlan);
    const text = await worker.processCustomReminderText(
      'Hi #{firstname}, #{action} is waiting.',
      templatePlan,
      'cid-123',
      templateTasks,
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
        textNotifsForActions: true,
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
        textNotifsForActions: true,
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

    const { form, snapshot: cohortSnapshot } = await createFormWithSnapshot(
      ctx.dataSource,
      {
        title: 'Cohort Form',
        schema: {
          title: 'Cohort Form',
          pages: [
            {
              id: 'page-1',
              fields: [
                { id: 'field-1', type: 'input', kind: 'text', label: 'Answer' },
              ],
            },
          ],
          outputViews: [],
        },
      },
    );

    // User submitted a form response
    await formResponseRepo.save(
      formResponseRepo.create({
        formId: form.id,
        form,
        answers: { 'field-1': 'yes' },
        formSnapshotId: cohortSnapshot.id,
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
        textNotifsForActions: true,
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

  // --- excludeOptionalActions tests ---

  it('excludeOptionalActions: suite with only optional actions sends no reminders', async () => {
    const now = Date.now();
    await clearUserContract(ctx.testUserId);

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({
        name: uniqueName('optional-only-suite'),
      }),
    );

    const eventDate = new Date(now - 60 * 60 * 1000);

    const { action: optionalAction, memberEvent } =
      await createActionWithMemberEvent({
        name: uniqueName('optional-action-only'),
        eventDate,
        suite,
        suiteManaged: true,
      });

    // Mark the action as optional
    await actionRepo.update(optionalAction.id, { optional: true });

    const suiteWithActions = await actionSuiteRepo.findOneOrFail({
      where: { id: suite.id },
      relations: { actions: true },
    });

    const user = await userRepo.save(
      userRepo.create({
        email: `${uniqueName('opt-only-user')}@example.com`,
        password: 'pass',
        name: 'Optional Only User',
        tags: [ctx.defaultTag],
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 72 * 60 * 60 * 1000),
            automatic: false,
            contractId: ctx.defaultContractId,
          } as ContractEvent,
        ],
        textNotifsForActions: true,
        phoneNumber: '+15555553001',
        phoneNumberValidated: true,
        emailNotifsForActions: false,
        turnedOffAllNotifs: false,
      }),
    );

    // User has NOT completed the optional action — but with excludeOptionalActions
    // there are no required actions, so no reminder should be sent.
    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        actionSuite: suiteWithActions,
        excludeOptionalActions: true,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    expect(notifs).toHaveLength(0);

    await userRepo.delete({ id: user.id });
  });

  it('excludeOptionalActions: user with only uncompleted optional actions gets no reminder', async () => {
    const now = Date.now();
    await clearUserContract(ctx.testUserId);

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({
        name: uniqueName('mixed-suite'),
      }),
    );

    const eventDate = new Date(now - 60 * 60 * 1000);

    const { action: requiredAction, memberEvent } =
      await createActionWithMemberEvent({
        name: uniqueName('required-action'),
        eventDate,
        suite,
        suiteManaged: true,
      });

    const { action: optionalAction } = await createActionWithMemberEvent({
      name: uniqueName('optional-action'),
      eventDate,
      suite,
      suiteManaged: true,
    });

    // Mark one action as optional
    await actionRepo.update(optionalAction.id, { optional: true });

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
          email: `${uniqueName(`excl-opt-${label}`)}@example.com`,
          password: 'pass',
          name: `ExclOpt ${label}`,
          tags: [ctx.defaultTag],
          contractEvents: [
            {
              type: ContractEventType.SIGNED,
              date: new Date(now - 72 * 60 * 60 * 1000),
              automatic: false,
              contractId: ctx.defaultContractId,
            } as ContractEvent,
          ],
          textNotifsForActions: true,
          phoneNumber: `+1555555${phoneSuffix}`,
          phoneNumberValidated: true,
          emailNotifsForActions: false,
          turnedOffAllNotifs: false,
        }),
      );

    // User A: completed required, NOT optional → should NOT get reminder
    const userA = await createSuiteUser('completedReq', '3101');
    await recordCompletion(userA, requiredAction);

    // User B: completed neither → SHOULD get reminder (uncompleted required action)
    const userB = await createSuiteUser('completedNone', '3102');

    // User C: completed both → should NOT get reminder
    const userC = await createSuiteUser('completedBoth', '3103');
    await recordCompletion(userC, requiredAction);
    await recordCompletion(userC, optionalAction);

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.AllUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        actionSuite: suiteWithActions,
        excludeOptionalActions: true,
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    const notifiedUserIds = notifs.map((n) => n.user.id);

    // Only userB should get a reminder (uncompleted required action)
    expect(notifiedUserIds).toContain(userB.id);
    expect(notifiedUserIds).not.toContain(userA.id);
    expect(notifiedUserIds).not.toContain(userC.id);

    await userRepo.delete([userA.id, userB.id, userC.id]);
  });

  it('excludeOptionalActions: GroupLeadsWithUncompleted ignores optional actions', async () => {
    const now = Date.now();

    const suite = await actionSuiteRepo.save(
      actionSuiteRepo.create({
        name: uniqueName('leader-opt-suite'),
      }),
    );

    const eventDate = new Date(now - 60 * 60 * 1000);

    const { action: requiredAction, memberEvent } =
      await createActionWithMemberEvent({
        name: uniqueName('leader-opt-required'),
        eventDate,
        suite,
        suiteManaged: true,
      });

    const { action: optionalAction } = await createActionWithMemberEvent({
      name: uniqueName('leader-opt-optional'),
      eventDate,
      suite,
      suiteManaged: true,
    });

    await actionRepo.update(optionalAction.id, { optional: true });

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
            `leader-opt-${label.toLowerCase().replace(/\s+/g, '-')}`,
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
          textNotifsForActions: true,
          phoneNumber: `+1555555${phoneSuffix}`,
          phoneNumberValidated: true,
          emailNotifsForActions: false,
          turnedOffAllNotifs: false,
          ...overrides,
        }),
      );

    // Leader of a community where members completed required but not optional
    const leaderAllRequiredDone = await createSignedUser(
      'Leader All Req Done',
      '4101',
      { remindAboutUncompletedGroupMembers: true },
    );

    // Leader of a community where members haven't completed required
    const leaderWithGaps = await createSignedUser('Leader With Gaps', '4102', {
      remindAboutUncompletedGroupMembers: true,
    });

    const communityAllReqDone = await communityRepo.save(
      communityRepo.create({
        name: uniqueName('community-all-req-done'),
        description: 'All required actions done',
        leaders: [leaderAllRequiredDone],
        users: [leaderAllRequiredDone],
      }),
    );

    const communityWithGaps = await communityRepo.save(
      communityRepo.create({
        name: uniqueName('community-with-gaps'),
        description: 'Has uncompleted required actions',
        leaders: [leaderWithGaps],
        users: [leaderWithGaps],
      }),
    );

    // Member who completed required but NOT optional
    const memberReqDone = await createSignedUser('Member Req Done', '4103', {
      communities: [communityAllReqDone],
      textNotifsForActions: false,
    });
    await recordCompletion(memberReqDone, requiredAction);
    // Deliberately not completing optionalAction
    await recordCompletion(leaderAllRequiredDone, requiredAction);
    await recordCompletion(leaderAllRequiredDone, optionalAction);

    // Member who hasn't completed required
    const memberNoReq = await createSignedUser('Member No Req', '4104', {
      communities: [communityWithGaps],
      textNotifsForActions: false,
    });
    await recordCompletion(leaderWithGaps, requiredAction);
    await recordCompletion(leaderWithGaps, optionalAction);

    const reminderGroup = await createReminderGroup(
      memberEvent,
      ReminderGroupTimingMode.Absolute,
      ReminderCohortType.GroupLeadsWithUncompleted,
      {
        sendAtAbsolute: new Date(now - 5 * 60 * 1000),
        actionSuite: suiteWithActions,
        excludeOptionalActions: true,
        textMessage: 'Leader reminder: #{nmembers} members need help.',
      },
    );

    await worker.dispatchDueNotifs();

    const notifs = await fetchNotifsForGroup(reminderGroup);
    const notifiedIds = notifs.map((n) => n.user.id);

    // Only leaderWithGaps should get notified (memberNoReq has uncompleted required action)
    // leaderAllRequiredDone should NOT be notified (memberReqDone completed all required actions)
    expect(notifiedIds).toContain(leaderWithGaps.id);
    expect(notifiedIds).not.toContain(leaderAllRequiredDone.id);

    await userRepo.delete([
      leaderAllRequiredDone.id,
      leaderWithGaps.id,
      memberReqDone.id,
      memberNoReq.id,
    ]);
    await communityRepo.delete([communityAllReqDone.id, communityWithGaps.id]);
  });
});
