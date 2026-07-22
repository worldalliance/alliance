import { Temporal } from '@js-temporal/polyfill';
import { getAmbassadorGoalHalfwayNotificationTime } from './ambassador-invite-goal-notification.utils';

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
