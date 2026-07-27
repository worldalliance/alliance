import { Temporal } from '@js-temporal/polyfill';
import {
  getAmbassadorGoalHalfwayNotificationMessage,
  getAmbassadorGoalHalfwayNotificationTime,
} from './ambassador-invite-goal-notification.utils';

describe('getAmbassadorGoalHalfwayNotificationTime', () => {
  const weeklongGoal = {
    startAt: new Date('2026-07-16T07:00:00.000Z'),
    dueAt: new Date('2026-07-24T07:00:00.000Z'),
  };

  it('uses the preferred time in the ambassador timezone', () => {
    const sendTime = getAmbassadorGoalHalfwayNotificationTime(weeklongGoal, {
      preferredReminderTime: Temporal.PlainTime.from('19:00:00'),
      timeZone: 'America/Los_Angeles',
    });

    expect(sendTime.toISOString()).toBe('2026-07-21T02:00:00.000Z');
  });

  it('uses the next local day when the preferred time has passed at midpoint', () => {
    const sendTime = getAmbassadorGoalHalfwayNotificationTime(
      {
        startAt: new Date('2026-07-20T19:00:00.000Z'),
        dueAt: new Date('2026-07-22T19:00:00.000Z'),
      },
      {
        preferredReminderTime: Temporal.PlainTime.from('09:00:00'),
        timeZone: 'America/Los_Angeles',
      },
    );

    expect(sendTime.toISOString()).toBe('2026-07-22T16:00:00.000Z');
  });

  it('defaults to 7 PM Pacific', () => {
    const sendTime = getAmbassadorGoalHalfwayNotificationTime(weeklongGoal, {});

    expect(sendTime.toISOString()).toBe('2026-07-21T02:00:00.000Z');
  });

  it('falls back to midpoint when the goal ends before the next preferred time', () => {
    const sendTime = getAmbassadorGoalHalfwayNotificationTime(
      {
        startAt: new Date('2026-07-20T18:00:00.000Z'),
        dueAt: new Date('2026-07-20T22:00:00.000Z'),
      },
      {
        preferredReminderTime: Temporal.PlainTime.from('19:00:00'),
        timeZone: 'America/Los_Angeles',
      },
    );

    expect(sendTime.toISOString()).toBe('2026-07-20T20:00:00.000Z');
  });
});

describe('getAmbassadorGoalHalfwayNotificationMessage', () => {
  const goal = {
    dueAt: new Date('2026-08-01T07:00:00.000Z'),
    targetSuccessfulRecruits: 5,
  };
  const sendTime = new Date('2026-07-18T19:00:00.000Z');

  it('includes the days, remaining people, and goal target', () => {
    expect(
      getAmbassadorGoalHalfwayNotificationMessage(goal, 2, sendTime),
    ).toBe(
      'You have 14 days left to successfully invite 3 more people and reach your goal of 5.',
    );
  });

  it('uses singular labels', () => {
    expect(
      getAmbassadorGoalHalfwayNotificationMessage(
        {
          dueAt: new Date('2026-07-19T19:00:00.000Z'),
          targetSuccessfulRecruits: 1,
        },
        0,
        sendTime,
      ),
    ).toBe(
      'You have 1 day left to successfully invite 1 more person and reach your goal of 1.',
    );
  });

  it('celebrates a goal that is already complete', () => {
    expect(
      getAmbassadorGoalHalfwayNotificationMessage(goal, 5, sendTime),
    ).toBe(
      "You have 14 days left, and you've already reached your goal of successfully inviting 5 people.",
    );
  });
});
