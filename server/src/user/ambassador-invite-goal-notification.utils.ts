import { Temporal } from '@js-temporal/polyfill';
import { DEFAULT_TIME_ZONE, type User } from './entities/user.entity';

type GoalWindow = {
  startAt: Date;
  dueAt: Date;
};

type ReminderTimingUser = Pick<User, 'preferredReminderTime' | 'timeZone'>;

const DEFAULT_REMINDER_TIME = Temporal.PlainTime.from('19:00:00');

/**
 * The first occurrence of the ambassador's preferred local reminder time at
 * or after the goal midpoint. For unusually short goals where no preferred
 * time remains before the goal ends, fall back to the midpoint so the
 * halfway check-in is not delivered after the goal-ended notification.
 */
export function getAmbassadorGoalHalfwayNotificationTime(
  goal: GoalWindow,
  ambassador: ReminderTimingUser,
): Date {
  const halfway = Temporal.Instant.fromEpochMilliseconds(
    goal.startAt.getTime() +
      Math.floor((goal.dueAt.getTime() - goal.startAt.getTime()) / 2),
  );
  const dueAt = Temporal.Instant.fromEpochMilliseconds(goal.dueAt.getTime());
  const timeZone = ambassador.timeZone ?? DEFAULT_TIME_ZONE;
  const preferredTime =
    ambassador.preferredReminderTime ?? DEFAULT_REMINDER_TIME;

  let preferredDate = halfway.toZonedDateTimeISO(timeZone).toPlainDate();
  let candidate = preferredDate
    .toPlainDateTime(preferredTime)
    .toZonedDateTime(timeZone)
    .toInstant();

  if (Temporal.Instant.compare(candidate, halfway) < 0) {
    preferredDate = preferredDate.add({ days: 1 });
    candidate = preferredDate
      .toPlainDateTime(preferredTime)
      .toZonedDateTime(timeZone)
      .toInstant();
  }

  if (Temporal.Instant.compare(candidate, dueAt) >= 0) {
    return new Date(halfway.epochMilliseconds);
  }

  return new Date(candidate.epochMilliseconds);
}
