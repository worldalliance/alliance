import { Temporal } from '@js-temporal/polyfill';
import { ActionsService } from 'src/actions/actions.service';
import { ActionDto } from 'src/actions/dto/action.dto';
import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import { Action } from 'src/actions/entities/action.entity';
import {
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
  getGroupSendTimeForUser,
} from 'src/actions/entities/reminder-group.entity';
import { MailService } from 'src/mail/mail.service';
import { MmsService } from 'src/mms/mms.service';
import { PushService } from 'src/push/push.service';
import { User } from 'src/user/entities/user.entity';
import { DataSource, type Repository } from 'typeorm';
import { ActionEventNotifWorker } from './action-event-notif.worker';
import {
  ActionEventReminderService,
  assertExcludePreviouslyNotifiedAllowed,
  comparePlansForDispatch,
  dropPlansPreemptedInSameCycle,
  tasksNotYetNotified,
} from './action-event-reminder.service';
import { NotificationPlan } from './dto/notification-plan.dto';
import { ActionEventNotif } from './entities/action-event-notif.entity';

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
      { id: 1, name: 'Task 1', timeEstimate: 15 },
      { id: 2, name: 'Task 2', timeEstimate: 30 },
      { id: 3, name: 'Task 3', timeEstimate: 45 },
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
    const uncompletedTasks = [{ id: 1, name: 'Task 1', timeEstimate: 15 }];
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
      {
        id: 1,
        name: 'Required',
        timeEstimate: 10,
        optional: false,
      } as unknown as ActionDto,
      {
        id: 2,
        name: 'Optional',
        timeEstimate: 5,
        optional: true,
      } as unknown as ActionDto,
      {
        id: 3,
        name: 'Also Required',
        timeEstimate: 20,
      } as unknown as ActionDto,
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
      'Deadline or anchor event is required for within_relative_range timing mode',
    );
  });

  it('anchors the relative window to timingAnchorEvent when set', () => {
    const deadlineEvent = {
      id: 2002,
      action,
      date: new Date('2024-04-15T18:00:00Z'),
      newStatus: ActionStatus.Completed,
    } as ActionEvent;
    const timingAnchorEvent = {
      id: 3000,
      date: new Date('2024-04-10T18:00:00Z'),
      newStatus: ActionStatus.Completed,
    } as ActionEvent;
    const user = {
      id: 45,
      name: 'Anchored User',
      preferredReminderTime: Temporal.PlainTime.from('10:00:00'),
      timeZone: 'UTC',
    } as User;

    const sendTime = getGroupSendTimeForUser(
      user,
      buildGroup({
        deadlineEvent,
        timingAnchorEvent,
        relative_range_start_seconds_from_deadline: 3 * 24 * 60 * 60,
        relative_range_end_seconds_from_deadline: 1 * 24 * 60 * 60,
      }),
    );

    // window is computed from the anchor (Apr 10), not the deadline (Apr 15)
    expect(sendTime?.toISOString()).toBe('2024-04-08T10:00:00.000Z');
  });
});

describe('getGroupSendTimeForUser (from deadline)', () => {
  const action = {
    id: 998,
    name: 'From Deadline Action',
  } as Action;
  const memberActionEvent = {
    id: 1001,
    action,
    date: new Date('2024-04-01T12:00:00Z'),
    newStatus: ActionStatus.MemberAction,
  } as ActionEvent;
  const user = {
    id: 46,
    name: 'From Deadline User',
    timeZone: 'UTC',
  } as User;

  const buildGroup = (overrides: Partial<ReminderGroup>): ReminderGroup =>
    ({
      id: 501,
      name: 'From Deadline Reminder',
      emailMessage: '',
      emailSubject: '',
      textMessage: '',
      cohortType: ReminderCohortType.AllUncompleted,
      timingMode: ReminderGroupTimingMode.FromDeadline,
      memberActionEvent,
      sendAtSecondsFromDeadline: 0,
      ...overrides,
    }) as ReminderGroup;

  const deadlineEvent = {
    id: 2003,
    action,
    date: new Date('2024-04-15T18:00:00Z'),
    newStatus: ActionStatus.Completed,
  } as ActionEvent;

  it('offsets from timingAnchorEvent when set', () => {
    const timingAnchorEvent = {
      id: 3001,
      date: new Date('2024-04-10T18:00:00Z'),
      newStatus: ActionStatus.Completed,
    } as ActionEvent;

    const sendTime = getGroupSendTimeForUser(
      user,
      buildGroup({
        deadlineEvent,
        timingAnchorEvent,
        sendAtSecondsFromDeadline: 3600,
      }),
    );

    expect(sendTime?.toISOString()).toBe('2024-04-10T17:00:00.000Z');
  });

  it('falls back to deadlineEvent when timingAnchorEvent is unset', () => {
    const sendTime = getGroupSendTimeForUser(
      user,
      buildGroup({ deadlineEvent, sendAtSecondsFromDeadline: 3600 }),
    );

    expect(sendTime?.toISOString()).toBe('2024-04-15T17:00:00.000Z');
  });

  it('throws when neither deadline nor anchor event is available', () => {
    expect(() =>
      getGroupSendTimeForUser(
        user,
        buildGroup({ deadlineEvent: undefined, timingAnchorEvent: undefined }),
      ),
    ).toThrow(
      'Deadline or anchor event is required for from_deadline timing mode',
    );
  });
});

describe('dropPlansPreemptedInSameCycle', () => {
  let nextGroupId = 1;
  const makePlan = ({
    userId,
    eventId,
    excludePreviouslyNotified,
    scheduledFor,
    cohortType = ReminderCohortType.AllUncompleted,
  }: {
    userId: number;
    eventId: number;
    excludePreviouslyNotified: boolean;
    scheduledFor: Date;
    cohortType?: ReminderCohortType;
  }): NotificationPlan => ({
    user: { id: userId } as User,
    group: {
      id: nextGroupId++,
      memberActionEvent: { id: eventId } as ActionEvent,
      excludePreviouslyNotified,
      cohortType,
    } as ReminderGroup,
    scheduledFor,
  });

  const t0 = new Date('2024-04-01T10:00:00Z');
  const t1 = new Date('2024-04-01T10:01:00Z');

  it('drops a catch-up plan preempted by an earlier plan for the same user and event', () => {
    const sibling = makePlan({
      userId: 1,
      eventId: 10,
      excludePreviouslyNotified: false,
      scheduledFor: t0,
    });
    const catchUp = makePlan({
      userId: 1,
      eventId: 10,
      excludePreviouslyNotified: true,
      scheduledFor: t1,
    });

    expect(dropPlansPreemptedInSameCycle([sibling, catchUp])).toEqual([
      sibling,
    ]);
  });

  it('keeps a catch-up plan when the earlier plan targets a different event', () => {
    const otherEvent = makePlan({
      userId: 1,
      eventId: 10,
      excludePreviouslyNotified: false,
      scheduledFor: t0,
    });
    const catchUp = makePlan({
      userId: 1,
      eventId: 11,
      excludePreviouslyNotified: true,
      scheduledFor: t1,
    });

    expect(dropPlansPreemptedInSameCycle([otherEvent, catchUp])).toEqual([
      otherEvent,
      catchUp,
    ]);
  });

  it('keeps a catch-up plan when the earlier plan targets a different user', () => {
    const otherUser = makePlan({
      userId: 2,
      eventId: 10,
      excludePreviouslyNotified: false,
      scheduledFor: t0,
    });
    const catchUp = makePlan({
      userId: 1,
      eventId: 10,
      excludePreviouslyNotified: true,
      scheduledFor: t1,
    });

    expect(dropPlansPreemptedInSameCycle([otherUser, catchUp])).toEqual([
      otherUser,
      catchUp,
    ]);
  });

  it('keeps both plans when the later group does not exclude previously notified users', () => {
    const first = makePlan({
      userId: 1,
      eventId: 10,
      excludePreviouslyNotified: false,
      scheduledFor: t0,
    });
    const second = makePlan({
      userId: 1,
      eventId: 10,
      excludePreviouslyNotified: false,
      scheduledFor: t1,
    });

    expect(dropPlansPreemptedInSameCycle([first, second])).toEqual([
      first,
      second,
    ]);
  });

  it('does not let a group-leads plan preempt a catch-up plan', () => {
    const groupLeadsNudge = makePlan({
      userId: 1,
      eventId: 10,
      excludePreviouslyNotified: false,
      scheduledFor: t0,
      cohortType: ReminderCohortType.GroupLeadsWithUncompleted,
    });
    const catchUp = makePlan({
      userId: 1,
      eventId: 10,
      excludePreviouslyNotified: true,
      scheduledFor: t1,
    });

    expect(dropPlansPreemptedInSameCycle([groupLeadsNudge, catchUp])).toEqual([
      groupLeadsNudge,
      catchUp,
    ]);
  });

  it('does not drop an earlier catch-up plan because of a later sibling plan', () => {
    const catchUp = makePlan({
      userId: 1,
      eventId: 10,
      excludePreviouslyNotified: true,
      scheduledFor: t0,
    });
    const sibling = makePlan({
      userId: 1,
      eventId: 10,
      excludePreviouslyNotified: false,
      scheduledFor: t1,
    });

    expect(dropPlansPreemptedInSameCycle([catchUp, sibling])).toEqual([
      catchUp,
      sibling,
    ]);
  });
});

describe('comparePlansForDispatch', () => {
  const makePlan = ({
    groupId,
    excludePreviouslyNotified,
    scheduledFor,
  }: {
    groupId: number;
    excludePreviouslyNotified: boolean;
    scheduledFor: Date;
  }): NotificationPlan => ({
    user: { id: 1 } as User,
    group: {
      id: groupId,
      memberActionEvent: { id: 10 } as ActionEvent,
      excludePreviouslyNotified,
      cohortType: ReminderCohortType.AllUncompleted,
    } as ReminderGroup,
    scheduledFor,
  });

  const t0 = new Date('2024-04-01T10:00:00Z');
  const t1 = new Date('2024-04-01T10:01:00Z');

  it('orders by send time first', () => {
    const later = makePlan({
      groupId: 1,
      excludePreviouslyNotified: true,
      scheduledFor: t1,
    });
    const earlier = makePlan({
      groupId: 2,
      excludePreviouslyNotified: false,
      scheduledFor: t0,
    });

    expect([later, earlier].sort(comparePlansForDispatch)).toEqual([
      earlier,
      later,
    ]);
  });

  it('dispatches the sibling before the catch-up on equal send times, regardless of incoming order', () => {
    const catchUp = makePlan({
      groupId: 1,
      excludePreviouslyNotified: true,
      scheduledFor: t0,
    });
    const sibling = makePlan({
      groupId: 2,
      excludePreviouslyNotified: false,
      scheduledFor: t0,
    });

    expect([catchUp, sibling].sort(comparePlansForDispatch)).toEqual([
      sibling,
      catchUp,
    ]);
    expect([sibling, catchUp].sort(comparePlansForDispatch)).toEqual([
      sibling,
      catchUp,
    ]);
  });

  it('breaks remaining ties by group id so dispatch order is deterministic', () => {
    const groupB = makePlan({
      groupId: 2,
      excludePreviouslyNotified: false,
      scheduledFor: t0,
    });
    const groupA = makePlan({
      groupId: 1,
      excludePreviouslyNotified: false,
      scheduledFor: t0,
    });

    expect([groupB, groupA].sort(comparePlansForDispatch)).toEqual([
      groupA,
      groupB,
    ]);
  });
});

describe('tasksNotYetNotified', () => {
  const tasks = [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
    { id: 3, name: 'c' },
  ];

  it('returns all tasks when the user has no prior coverage', () => {
    expect(tasksNotYetNotified(tasks, [])).toEqual(tasks);
  });

  it('drops tasks covered by prior notifs, across multiple notifs', () => {
    expect(tasksNotYetNotified(tasks, [[1], [2]])).toEqual([
      { id: 3, name: 'c' },
    ]);
  });

  it('returns nothing when every task was covered', () => {
    expect(tasksNotYetNotified(tasks, [[1, 2, 3]])).toEqual([]);
  });

  it('treats a legacy null coverage entry as having covered everything', () => {
    expect(tasksNotYetNotified(tasks, [[1], null])).toEqual([]);
  });

  it('ignores covered actions that are no longer among the tasks', () => {
    expect(tasksNotYetNotified(tasks, [[99]])).toEqual(tasks);
  });
});

describe('assertExcludePreviouslyNotifiedAllowed', () => {
  it('rejects excludePreviouslyNotified on a group-leads cohort', () => {
    expect(() =>
      assertExcludePreviouslyNotifiedAllowed({
        cohortType: ReminderCohortType.GroupLeadsWithUncompleted,
        excludePreviouslyNotified: true,
      }),
    ).toThrow(
      'excludePreviouslyNotified is not supported for group-leads cohorts',
    );
  });

  it('allows a group-leads cohort without the flag', () => {
    expect(() =>
      assertExcludePreviouslyNotifiedAllowed({
        cohortType: ReminderCohortType.GroupLeadsWithUncompleted,
        excludePreviouslyNotified: false,
      }),
    ).not.toThrow();
  });

  it.each([
    ReminderCohortType.AllUncompleted,
    ReminderCohortType.Tag,
    ReminderCohortType.Custom,
  ])('allows the flag on the personally-notifying %s cohort', (cohortType) => {
    expect(() =>
      assertExcludePreviouslyNotifiedAllowed({
        cohortType,
        excludePreviouslyNotified: true,
      }),
    ).not.toThrow();
  });
});
