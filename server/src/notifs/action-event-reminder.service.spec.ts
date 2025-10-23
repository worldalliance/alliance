import { Repository } from 'typeorm';
import { ActionEventReminderService } from './action-event-reminder.service';
import { ActionEventNotifType } from './entities/action-event-notif.entity';
import {
  ActionStatus,
  NotificationType,
} from '../actions/entities/action-event.entity';
import {
  ActionActivity,
  ActionActivityType,
} from '../actions/entities/action-activity.entity';
import { ActionEvent } from '../actions/entities/action-event.entity';
import { ActionEventRecipientService } from './action-event-recipient.service';
import { Action, ActionTaskType } from 'src/actions/entities/action.entity';
import {
  ActionReminder,
  ReminderCohortType,
  ReminderTimingMode,
} from 'src/actions/entities/action-reminder.entity';
import { User } from 'src/user/entities/user.entity';

const announcementEvent = (overrides: Partial<ActionEvent> = {}): ActionEvent =>
  ({
    id: 1,
    date: new Date('2024-01-11T12:00:00Z'),
    newStatus: ActionStatus.GatheringCommitments,
    sendNotifsTo: NotificationType.All,
    announcementNotifsSentAt: null,
    action: {
      id: 10,
      name: 'Announcement Action',
      participatingGroups: [],
    },
    ...overrides,
  }) as unknown as ActionEvent;

const defaultReminderEventAction = {
  id: 20,
  name: 'Reminder Action',
  participatingGroups: [],
  category: '',
  commitmentless: false,
  body: '',
  shortDescription: '',
  type: ActionTaskType.Activity,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  events: [],
  usersJoined: 0,
  activities: [],
  status: ActionStatus.Draft,
  usersCompleted: 0,
  everyoneShouldComplete: false,
  archived: false,
  updates: [],
} satisfies Action;

const reminderEvent = (overrides: Partial<ActionEvent> = {}): ActionEvent => ({
  id: 2,
  title: 'Reminder Event',
  description: 'Reminder Description',
  sendNotifsTo: NotificationType.All,
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  showInTimeline: false,
  notifications: [],
  reminders: [],
  action: defaultReminderEventAction,
  date: new Date('2024-01-13T12:00:00Z'),
  newStatus: ActionStatus.Resolution,
  updates: [],
  ...overrides,
});

const customReminder = (
  overrides: Partial<ActionReminder> = {},
): ActionReminder =>
  ({
    id: 42,
    memberActionEvent: reminderEvent({
      id: 700,
      newStatus: ActionStatus.MemberAction,
      action: {
        ...defaultReminderEventAction,
        id: 999,
        participatingGroups: [],
      },
    }),
    users: [
      {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        phoneNumber: '+15555550100',
        groups: [],
      } as unknown as User,
    ],
    cohortType: ReminderCohortType.AllUncompleted,
    timingMode: ReminderTimingMode.Absolute,
    emailMessage: 'Custom email message',
    emailSubject: 'Custom email subject',
    textMessage: 'Custom text message',
    sentAt: undefined,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    notifications: [],
    ...overrides,
  }) satisfies ActionReminder;

describe('ActionEventReminderService', () => {
  let eventQueryMock: jest.Mock;
  let repositoryMock: { query: jest.Mock; find: jest.Mock };
  let activityRepositoryMock: { find: jest.Mock };
  let reminderRepositoryMock: { find: jest.Mock };
  let recipientServiceMock: {
    getBaseUsersForEvent: jest.Mock;
    getFilteredUsersForEvent: jest.Mock;
  };
  let service: ActionEventReminderService;

  beforeEach(() => {
    eventQueryMock = jest.fn();
    repositoryMock = {
      query: eventQueryMock,
      find: jest.fn().mockResolvedValue([]),
    };
    activityRepositoryMock = {
      find: jest.fn().mockResolvedValue([]),
    };
    reminderRepositoryMock = {
      find: jest.fn().mockResolvedValue([]),
    };

    recipientServiceMock = {
      getBaseUsersForEvent: jest.fn().mockResolvedValue([]),
      getFilteredUsersForEvent: jest.fn().mockResolvedValue([]),
    };

    service = new ActionEventReminderService(
      repositoryMock as unknown as Repository<ActionEvent>,
      activityRepositoryMock as unknown as Repository<ActionActivity>,
      reminderRepositoryMock as unknown as Repository<ActionReminder>,
      recipientServiceMock as unknown as ActionEventRecipientService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findMissedDeadlineCandidates', () => {
    it('identifies missed deadlines and second misses', async () => {
      (repositoryMock.find as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          action: { id: 100, name: 'Deadline Action' },
          date: new Date('2024-01-05T12:00:00Z'),
          newStatus: ActionStatus.MemberAction,
        } as unknown as ActionEvent,
        {
          id: 2,
          action: { id: 100, name: 'Deadline Action' },
          date: new Date('2024-01-10T12:00:00Z'),
          newStatus: ActionStatus.OfficeAction,
        } as unknown as ActionEvent,
      ]);

      eventQueryMock.mockResolvedValueOnce([
        {
          id: 1,
          actionId: 100,
          date: new Date('2024-01-05T12:00:00Z'),
          newStatus: ActionStatus.MemberAction,
        },
        {
          id: 2,
          actionId: 100,
          date: new Date('2024-01-10T12:00:00Z'),
          newStatus: ActionStatus.OfficeAction,
        },
      ]);

      activityRepositoryMock.find.mockResolvedValue([
        {
          actionId: 100,
          userId: 1,
          type: ActionActivityType.USER_JOINED,
          createdAt: new Date('2024-01-04T00:00:00Z'),
        },
      ]);

      const results = await service.findMissedDeadlineCandidates(
        new Date('2024-01-07T00:00:00Z'),
        new Date('2024-01-12T00:00:00Z'),
      );

      //   const sanitized = results.map((candidate) => {
      //     const { _timelineDate, ...rest } = candidate;
      //     return rest;
      //   });

      expect(results.length).toBe(1);
      expect(results[0]).toMatchObject({
        actionId: 100,
        userId: 1,
        deadlineEventId: 1,
        deadlineDate: new Date('2024-01-05T12:00:00Z'),
        resolutionEventId: 2,
        resolutionDate: new Date('2024-01-10T12:00:00Z'),
      });
    });
  });

  it('includes absolute reminder plans', async () => {
    const windowStart = new Date('2024-01-12T00:00:00Z');
    const windowEnd = new Date('2024-01-12T23:59:59Z');

    (repositoryMock.find as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    reminderRepositoryMock.find.mockResolvedValueOnce([
      customReminder({
        sendAtAbsolute: new Date('2024-01-12T12:00:00Z'),
        timingMode: ReminderTimingMode.Absolute,
      }),
    ]);

    jest
      .spyOn(
        service as unknown as { findMissedDeadlineCandidates: jest.Mock },
        'findMissedDeadlineCandidates',
      )
      .mockResolvedValueOnce([]);

    const plans = await service.evaluateNotifications(windowStart, windowEnd);

    expect(plans).toHaveLength(1);
    const plan = plans[0];
    expect(plan.type).toBe(ActionEventNotifType.Reminder);
    expect(plan.reminder?.id).toBe(42);
    expect(plan.reminder?.users?.length).toBe(1);
  });

  it('includes relative reminder plans', async () => {
    const windowStart = new Date('2024-01-12T00:00:00Z');
    const windowEnd = new Date('2024-01-12T23:59:59Z');

    (repositoryMock.find as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    reminderRepositoryMock.find.mockResolvedValueOnce([
      customReminder({
        sendAtSecondsFromDeadline: 1000,
        timingMode: ReminderTimingMode.FromDeadline,
      }),
    ]);

    jest
      .spyOn(
        service as unknown as { findMissedDeadlineCandidates: jest.Mock },
        'findMissedDeadlineCandidates',
      )
      .mockResolvedValueOnce([]);

    const plans = await service.evaluateNotifications(windowStart, windowEnd);

    expect(plans).toHaveLength(1);
    const plan = plans[0];
    expect(plan.type).toBe(ActionEventNotifType.Reminder);
    expect(plan.reminder?.id).toBe(42);
    expect(plan.reminder?.users?.length).toBe(1);
  });

  describe('getNotificationSchedule', () => {
    it('maps evaluation plans to DTOs', async () => {
      const plan = {
        type: ActionEventNotifType.Announcement,
        scheduledFor: new Date('2024-01-11T12:00:00Z'),
        referenceEvent: announcementEvent(),
        targetEvent: announcementEvent(),
        metadata: { currentEventId: 1 },
      };

      jest
        .spyOn(
          service as unknown as { evaluateNotifications: jest.Mock },
          'evaluateNotifications',
        )
        .mockResolvedValueOnce([plan]);

      const result = await service.getNotificationSchedule(
        new Date('2024-01-10T12:00:00Z'),
        new Date('2024-01-12T12:00:00Z'),
      );

      expect(result).toEqual([
        {
          type: plan.type,
          scheduledFor: plan.scheduledFor,
          actionId: plan.referenceEvent.action!.id,
          actionName: plan.referenceEvent.action!.name,
          actionStatus: plan.referenceEvent.newStatus,
          eventId: plan.targetEvent.id,
          recipients: [],
          metadata: plan.metadata,
        },
      ]);
    });
  });
});
