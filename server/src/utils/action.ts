import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import { Action } from 'src/actions/entities/action.entity';
import { findLeast } from './filter';

export function computeLatestMemberActionAndDeadline(params: {
  action: Pick<Action, 'events'>;
}):
  | { event: ActionEvent; endDate: Date }
  | {
      event: ActionEvent;
      endDate: null;
    }
  | {
      event: null;
      endDate: null;
    } {
  const {
    action: { events },
  } = params;
  const latestMemberActionEvent = findLeast(
    events,
    (a, b) => b.date.getTime() - a.date.getTime(), // reverse order
    (event) => event.newStatus === ActionStatus.MemberAction,
  );
  if (!latestMemberActionEvent) {
    return { event: null, endDate: null };
  }

  const earliestDeadline = findLeast(
    events,
    (a, b) => a.date.getTime() - b.date.getTime(),
    (event) =>
      event.newStatus !== ActionStatus.MemberAction &&
      event.date > latestMemberActionEvent.date,
  );

  return {
    event: latestMemberActionEvent,
    endDate: earliestDeadline?.date ?? null,
  };
}

export function computeLatestMemberActionPhaseExistsAndIsOver(params: {
  action: Pick<Action, 'events'>;
  date: Date;
}): boolean {
  const { action, date } = params;

  const { event: latestMemberActionEvent, endDate } =
    computeLatestMemberActionAndDeadline({
      action,
    });

  if (!latestMemberActionEvent) {
    return false;
  }
  if (!endDate) {
    return false;
  }
  return endDate <= date;
}

export function computeActionStatusAt(params: {
  action: Pick<Action, 'events'>;
  date: Date;
}): ActionStatus {
  const { action, date } = params;

  const latestEventBeforeDate = findLeast(
    action.events,
    (a, b) => b.date.getTime() - a.date.getTime(), // reverse order
    (event) => event.date < date,
  );

  return latestEventBeforeDate
    ? latestEventBeforeDate.newStatus
    : ActionStatus.Draft;
}
