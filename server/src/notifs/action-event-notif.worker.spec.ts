import { Temporal } from '@js-temporal/polyfill';
import { DataSource, type Repository } from 'typeorm';
import { ActionEventNotifWorker } from './action-event-notif.worker';
import { NotificationPlan } from './action-event-reminder.service';
import { MailService } from 'src/mail/mail.service';
import { MmsService } from 'src/mms/mms.service';
import { ActionsService } from 'src/actions/actions.service';
import { ActionEventNotif } from './entities/action-event-notif.entity';
import {
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
  getGroupSendTimeForUser,
} from 'src/actions/entities/reminder-group.entity';
import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import { Action } from 'src/actions/entities/action.entity';
import { User } from 'src/user/entities/user.entity';
import { ActionEventReminderService } from './action-event-reminder.service';
import { ActionDto } from 'src/actions/dto/action.dto';
import { PushService } from 'src/push/push.service';
import * as notifsService from './notifs.service';
import { EmailStatus, type Mail } from 'src/mail/mail.entity';

describe('ActionEventNotifWorker.processOne', () => {
  const spies = () => {
    const emailSpy = jest
      .spyOn(notifsService, 'shouldEmailUser')
      .mockReturnValue(true);
    const textSpy = jest
      .spyOn(notifsService, 'shouldTextUser')
      .mockReturnValue(false);
    const pushSpy = jest
      .spyOn(notifsService, 'shouldPushUser')
      .mockReturnValue(false);
    return { emailSpy, textSpy, pushSpy };
  };

  it('does not email post-deadline when user has zero uncompleted tasks', async () => {
    const { emailSpy, textSpy, pushSpy } = spies();

    const actionsService = {
      findUncompletedTasks: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ActionsService>;

    const mailService = {
      sendActionEventNotificationEmail: jest.fn(),
    };

    const save = jest.fn(async (n: ActionEventNotif) => n);
    const repo = {
      create: jest.fn((x: Partial<ActionEventNotif>) => x),
      save,
    } as unknown as Repository<ActionEventNotif>;

    const reminderService = {
      findUncompletedMembersInCommunities: jest.fn(),
    } as unknown as ActionEventReminderService;

    const worker = new ActionEventNotifWorker(
      {} as DataSource,
      mailService as unknown as MailService,
      {} as MmsService,
      actionsService,
      repo,
      reminderService,
      {} as PushService,
    );

    const action = { id: 1, name: 'Action A' } as Action;
    const memberActionEvent = {
      id: 10,
      action,
      date: new Date('2025-01-01T12:00:00Z'),
      newStatus: ActionStatus.MemberAction,
    } as ActionEvent;
    const deadlineEvent = {
      id: 11,
      action,
      date: new Date('2025-01-10T12:00:00Z'),
      newStatus: ActionStatus.Completed,
    } as ActionEvent;
    const plan: NotificationPlan = {
      scheduledFor: new Date('2025-01-11T12:00:00Z'),
      user: { id: 99, name: 'Test User' } as User,
      group: {
        id: 55,
        cohortType: ReminderCohortType.AllUncompleted,
        useSuiteTaskCount: false,
        memberActionEvent,
        deadlineEvent,
        emailMessage: 'x',
        emailSubject: 'y',
        textMessage: '',
        pushMessage: '',
      } as ReminderGroup,
    };

    await (
      worker as unknown as {
        processOne: (p: NotificationPlan) => Promise<void>;
      }
    ).processOne(plan);

    expect(actionsService.findUncompletedTasks).toHaveBeenCalledWith(
      99,
      undefined,
    );
    expect(actionsService.findUncompletedTasks).toHaveBeenCalledTimes(1);
    expect(
      mailService.sendActionEventNotificationEmail,
    ).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(2);
    const finalArg = save.mock.calls[1][0] as ActionEventNotif;
    expect(finalArg.sent).toBe(true);

    emailSpy.mockRestore();
    textSpy.mockRestore();
    pushSpy.mockRestore();
  });

  it('still emails pre-deadline when user has zero uncompleted tasks', async () => {
    const { emailSpy, textSpy, pushSpy } = spies();

    const actionsService = {
      findUncompletedTasks: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ActionsService>;

    const mailService = {
      sendActionEventNotificationEmail: jest
        .fn()
        .mockResolvedValue({ status: EmailStatus.Sent } as Mail),
    };

    const save = jest.fn(async (n: ActionEventNotif) => n);
    const repo = {
      create: jest.fn((x: Partial<ActionEventNotif>) => x),
      save,
    } as unknown as Repository<ActionEventNotif>;

    const reminderService = {
      findUncompletedMembersInCommunities: jest.fn(),
    } as unknown as ActionEventReminderService;

    const worker = new ActionEventNotifWorker(
      {} as DataSource,
      mailService as unknown as MailService,
      {} as MmsService,
      actionsService,
      repo,
      reminderService,
      {} as PushService,
    );

    const action = { id: 1, name: 'Action A' } as Action;
    const memberActionEvent = {
      id: 10,
      action,
      date: new Date('2025-01-01T12:00:00Z'),
      newStatus: ActionStatus.MemberAction,
    } as ActionEvent;
    const deadlineEvent = {
      id: 11,
      action,
      date: new Date('2025-01-20T12:00:00Z'),
      newStatus: ActionStatus.Completed,
    } as ActionEvent;
    const plan: NotificationPlan = {
      scheduledFor: new Date('2025-01-10T12:00:00Z'),
      user: { id: 99, name: 'Test User' } as User,
      group: {
        id: 56,
        cohortType: ReminderCohortType.AllUncompleted,
        useSuiteTaskCount: false,
        memberActionEvent,
        deadlineEvent,
        emailMessage: 'body',
        emailSubject: 'subj',
        textMessage: '',
        pushMessage: '',
      } as ReminderGroup,
    };

    await (
      worker as unknown as {
        processOne: (p: NotificationPlan) => Promise<void>;
      }
    ).processOne(plan);

    expect(mailService.sendActionEventNotificationEmail).toHaveBeenCalled();
    expect(actionsService.findUncompletedTasks).toHaveBeenCalledTimes(1);
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(2);

    emailSpy.mockRestore();
    textSpy.mockRestore();
    pushSpy.mockRestore();
  });
});

describe('ActionEventNotifWorker.processCustomReminderText', () => {
  let worker: ActionEventNotifWorker;
  let actionsService: jest.Mocked<ActionsService>;
  let originalAppUrl: string | undefined;

  beforeAll(() => {
    originalAppUrl = process.env.APP_URL;
    process.env.APP_URL = 'https://app.example.org';
  });

  afterAll(() => {
    process.env.APP_URL = originalAppUrl;
  });

  beforeEach(() => {
    actionsService = {
      findUncompletedTasks: jest.fn(),
    } as unknown as jest.Mocked<ActionsService>;

    worker = new ActionEventNotifWorker(
      {} as DataSource,
      {} as MailService,
      {} as MmsService,
      actionsService,
      {} as Repository<ActionEventNotif>,
      {} as ActionEventReminderService,
      {} as PushService,
    );
  });

  it('replaces all reminder keywords when a deadline event is present', async () => {
    const uncompletedTasks = [
      { name: 'Task 1', timeEstimate: 15 },
      { name: 'Task 2', timeEstimate: 30 },
      { name: 'Task 3', timeEstimate: 45 },
    ];
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    try {
      const action = { id: 42, name: 'Test Action' } as Action;
      const memberActionEvent = {
        id: 101,
        action,
        date: new Date('2023-12-15T12:00:00Z'),
        newStatus: ActionStatus.MemberAction,
      } as ActionEvent;
      const deadlineEvent = {
        id: 202,
        action,
        date: new Date('2024-01-03T06:00:00Z'),
        newStatus: ActionStatus.Completed,
      } as ActionEvent;

      const plan: NotificationPlan = {
        scheduledFor: new Date('2024-01-02T00:00:00Z'),
        user: {
          id: 7,
          name: 'Alex Example',
        } as User,
        group: {
          id: 5,
          name: 'Reminder #1',
          timingMode: ReminderGroupTimingMode.Absolute,
          cohortType: ReminderCohortType.AllUncompleted,
          emailMessage: '',
          emailSubject: '',
          textMessage: '',
          memberActionEvent,
          deadlineEvent,
        } as ReminderGroup,
      };

      const template =
        'Hi #{firstname} #{lastname} (#{fullname}), action #{action} has #{n} tasks due in #{days} and #{hours}. Link: #{link}';

      const result = await worker.processCustomReminderText(
        template,
        plan,
        'cid-123',
        uncompletedTasks,
      );

      expect(result).toBe(
        'Hi Alex Example (Alex Example), action Test Action has 3 tasks due in 2 days and 6 hours. Link: https://app.example.org/tasks?cid=cid-123',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back gracefully when user has a single name and no deadline event', async () => {
    const uncompletedTasks = [{ name: 'Task 1', timeEstimate: 15 }];
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const action = { id: 12, name: 'Tree Planting' } as Action;
    const memberActionEvent = {
      id: 303,
      action,
      date: new Date('2024-02-10T10:00:00Z'),
      newStatus: ActionStatus.MemberAction,
    } as ActionEvent;

    const plan: NotificationPlan = {
      scheduledFor: new Date('2024-02-11T12:00:00Z'),
      user: {
        id: 9,
        name: 'Cher',
      } as User,
      group: {
        id: 6,
        name: 'Reminder #2',
        timingMode: ReminderGroupTimingMode.WithinRange,
        cohortType: ReminderCohortType.AllUncompleted,
        emailMessage: '',
        emailSubject: '',
        textMessage: '',
        memberActionEvent,
      } as ReminderGroup,
    };

    const template =
      'Hello #{firstname}! Deadline in #{days} / #{hours}. Tasks left: #{n}. Visit #{link}';

    try {
      const result = await worker.processCustomReminderText(
        template,
        plan,
        'cid-456',
        uncompletedTasks,
      );

      expect(result).toBe(
        'Hello Cher! Deadline in [err] / [err]. Tasks left: 1. Visit https://app.example.org/tasks?cid=cid-456',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'User name has less than 2 parts: Cher',
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

describe('ActionEventNotifWorker.findUncompletedTasksForPlan', () => {
  let worker: ActionEventNotifWorker;
  let actionsService: jest.Mocked<ActionsService>;

  beforeEach(() => {
    actionsService = {
      findUncompletedTasks: jest.fn(),
    } as unknown as jest.Mocked<ActionsService>;

    worker = new ActionEventNotifWorker(
      {} as DataSource,
      {} as MailService,
      {} as MmsService,
      actionsService,
      {} as Repository<ActionEventNotif>,
      {} as ActionEventReminderService,
      {} as PushService,
    );
  });

  it('filters out optional tasks when excludeOptionalActions is set', async () => {
    actionsService.findUncompletedTasks.mockResolvedValue([
      { id: 1, name: 'Required', timeEstimate: 10, optional: false } as unknown as ActionDto,
      { id: 2, name: 'Optional', timeEstimate: 5, optional: true } as unknown as ActionDto,
      { id: 3, name: 'Also Required', timeEstimate: 20 } as unknown as ActionDto,
    ]);

    const plan: NotificationPlan = {
      scheduledFor: new Date(),
      user: { id: 1 } as User,
      group: {
        id: 1,
        excludeOptionalActions: true,
        memberActionEvent: { action: {} },
      } as unknown as ReminderGroup,
    };

    const result = await worker.findUncompletedTasksForPlan(plan);

    expect(result).toEqual([
      expect.objectContaining({ name: 'Required' }),
      expect.objectContaining({ name: 'Also Required' }),
    ]);
  });

  it('returns all tasks when excludeOptionalActions is not set', async () => {
    actionsService.findUncompletedTasks.mockResolvedValue([
      { id: 1, name: 'Required', optional: false } as unknown as ActionDto,
      { id: 2, name: 'Optional', optional: true } as unknown as ActionDto,
    ]);

    const plan: NotificationPlan = {
      scheduledFor: new Date(),
      user: { id: 1 } as User,
      group: {
        id: 1,
        excludeOptionalActions: false,
        memberActionEvent: { action: {} },
      } as unknown as ReminderGroup,
    };

    const result = await worker.findUncompletedTasksForPlan(plan);

    expect(result).toHaveLength(2);
  });
});

describe('getGroupSendTimeForUser (relative range)', () => {
  const action = {
    id: 999,
    name: 'Relative Range Action',
  } as Action;
  const memberActionEvent = {
    id: 1000,
    action,
    date: new Date('2024-04-01T12:00:00Z'),
    newStatus: ActionStatus.MemberAction,
  } as ActionEvent;

  const buildGroup = (overrides: Partial<ReminderGroup>): ReminderGroup =>
    ({
      id: 500,
      name: 'Relative Range Reminder',
      emailMessage: '',
      emailSubject: '',
      textMessage: '',
      cohortType: ReminderCohortType.AllUncompleted,
      timingMode: ReminderGroupTimingMode.WithinRelativeRange,
      memberActionEvent,
      relative_range_start_seconds_from_deadline: 0,
      relative_range_end_seconds_from_deadline: 0,
      ...overrides,
    }) as ReminderGroup;

  it('returns the first personalized reminder time that falls within the relative window', () => {
    const deadlineEvent = {
      id: 2000,
      action,
      date: new Date('2024-04-15T18:00:00Z'),
      newStatus: ActionStatus.Completed,
    } as ActionEvent;
    const user = {
      id: 42,
      name: 'Relative Range User',
      preferredReminderTime: Temporal.PlainTime.from('10:00:00'),
      timeZone: 'UTC',
    } as User;

    const sendTime = getGroupSendTimeForUser(
      user,
      buildGroup({
        deadlineEvent,
        relative_range_start_seconds_from_deadline: 3 * 24 * 60 * 60,
        relative_range_end_seconds_from_deadline: 1 * 24 * 60 * 60,
      }),
    );

    expect(sendTime?.toISOString()).toBe('2024-04-13T10:00:00.000Z');
  });

  it('returns null when the preferred reminder time never lands inside the narrow window', () => {
    const deadlineEvent = {
      id: 2001,
      action,
      date: new Date('2024-05-01T12:00:00Z'),
      newStatus: ActionStatus.Completed,
    } as ActionEvent;
    const user = {
      id: 43,
      name: 'Night Owl',
      preferredReminderTime: Temporal.PlainTime.from('23:00:00'),
      timeZone: 'UTC',
    } as User;

    const sendTime = getGroupSendTimeForUser(
      user,
      buildGroup({
        deadlineEvent,
        relative_range_start_seconds_from_deadline: 6 * 60 * 60,
        relative_range_end_seconds_from_deadline: 4 * 60 * 60,
      }),
    );

    expect(sendTime).toBeNull();
  });

  it('throws when no deadline event is available for relative range mode', () => {
    const user = {
      id: 44,
      name: 'Missing Deadline Tester',
      preferredReminderTime: Temporal.PlainTime.from('08:00:00'),
      timeZone: 'UTC',
    } as User;

    expect(() =>
      getGroupSendTimeForUser(
        user,
        buildGroup({
          deadlineEvent: undefined,
          relative_range_start_seconds_from_deadline: 2 * 24 * 60 * 60,
          relative_range_end_seconds_from_deadline: 24 * 60 * 60,
        }),
      ),
    ).toThrow(
      'Deadline event is required for within_relative_range timing mode',
    );
  });
});
