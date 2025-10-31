import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import { actionUrl, withCid } from 'src/search/approutes';
import { ActionEventNotificationContext } from './action-event-notif.worker';

type announcedStates =
  | ActionStatus.GatheringCommitments
  | ActionStatus.MemberAction;

export function getDaysFromDeadline(deadlineEvent: ActionEvent): string {
  const days = Math.round(
    (deadlineEvent.date.getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24),
  );
  return days.toString() + ' day' + (days === 1 ? '' : 's');
}

export function getHoursFromDeadline(deadlineEvent: ActionEvent): string {
  const hours =
    Math.round(
      (deadlineEvent.date.getTime() - new Date().getTime()) / (1000 * 60 * 60),
    ) % 24;
  return hours.toString() + ' hour' + (hours === 1 ? '' : 's');
}

export const welcomeMessage = `Thanks for opting in to action notifications from the Alliance! You'll get a text here when a new action is ready to complete. Reply STOP to opt out.`;

export const defaultEventTextAnnouncement: {
  [x in announcedStates]: (context: ActionEventNotificationContext) => string;
} = {
  [ActionStatus.GatheringCommitments]: (context) =>
    `New Alliance action: ${context.action.name}. Please confirm commitment at ${withCid(actionUrl(context.action.id, true), context.cid)}`,
  [ActionStatus.MemberAction]: (context) =>
    `An Alliance action ${context.action.commitmentless ? '' : 'you committed to '}is ready for you to complete: ${context.action.name}. ${withCid(actionUrl(context.action.id, true), context.cid)}. ${context.deadlineEvent ? `You have ${getDaysFromDeadline(context.deadlineEvent)} to complete.` : ''}`,
};

export const defaultEventText3DayReminder: {
  [x in announcedStates]: (context: ActionEventNotificationContext) => string;
} = {
  [ActionStatus.GatheringCommitments]: (context) =>
    `You have 3 days left to confirm participation in: ${context.action.name}. ${withCid(actionUrl(context.action.id, true), context.cid)}`,
  [ActionStatus.MemberAction]: (context) =>
    `You have 3 days left to ${context.action.commitmentless ? 'complete' : 'fulfill your commitment to'}: ${context.action.name}. ${withCid(actionUrl(context.action.id, true), context.cid)}`,
};

export const defaultEventText1DayReminder: {
  [x in announcedStates]: (context: ActionEventNotificationContext) => string;
} = {
  [ActionStatus.GatheringCommitments]: (context) =>
    `You have 1 day left to confirm participation in: ${context.action.name}. ${withCid(actionUrl(context.action.id, true), context.cid)}`,
  [ActionStatus.MemberAction]: (context) =>
    `You have 1 day left to ${context.action.commitmentless ? 'complete' : 'fulfill your commitment to'}: ${context.action.name}. ${withCid(actionUrl(context.action.id, true), context.cid)}`,
};

export const defaultEventTextMissedDeadline = (
  context: ActionEventNotificationContext,
) =>
  `You failed to complete: ${context.action.name}. The deadline has now passed.`;

export const defaultEventTextMissedSecondDeadline = (
  context: ActionEventNotificationContext,
) =>
  `You failed to complete: ${context.action.name}. As you have not completed two actions in a row, you are no longer an active Alliance member.`;
