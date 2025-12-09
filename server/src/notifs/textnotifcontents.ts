import { ActionEvent } from 'src/actions/entities/action-event.entity';

export function plural(n: number, word: string): string {
  return n.toString() + ' ' + word + (n === 1 ? '' : 's');
}

export function getTimeLeftString(
  deadlineEvent: ActionEvent,
  dateNow: Date,
  mode: 'both' | 'days' | 'hours' = 'both',
): string {
  if (dateNow.getTime() > deadlineEvent.date.getTime()) {
    return '0 ' + (mode === 'days' ? 'days' : 'hours');
  }
  let days = Math.floor(
    (deadlineEvent.date.getTime() - dateNow.getTime()) / (1000 * 60 * 60 * 24),
  );
  let hours = Math.round(
    (deadlineEvent.date.getTime() -
      dateNow.getTime() -
      days * 1000 * 60 * 60 * 24) /
      (1000 * 60 * 60),
  );

  if (hours === 24) {
    days += 1;
    hours = 0;
  }

  if (mode === 'hours') {
    return plural(hours, 'hour');
  }
  if (mode === 'days') {
    return plural(days, 'day');
  }

  if (days === 0) {
    return plural(hours, 'hour');
  }
  if (hours === 0) {
    return plural(days, 'day');
  }

  const daysString = plural(days, 'day');
  const hoursString = plural(hours, 'hour');

  return `${daysString}, ${hoursString}`;
}

export const welcomeMessage = `Thanks for opting in to action notifications from the Alliance! You'll get a text here when a new action is ready to complete. Reply STOP to opt out.`;

export const suspensionMessage = `You did not fully complete any of the last three weeks of actions, so we've suspended your Alliance contract automatically. `;
