import { findLeast } from "src/utils/filter";
import { ActionEvent, ActionStatus } from "../entities/action-event.entity";

export type MemberActionPhase =
  | {
      event: ActionEvent;
      deadlineEvent: ActionEvent | null;
    }
  | { event: null; deadlineEvent: null };

/**
 * Each event is in effect over `[its date, the next event's date)`, so an event
 * has taken effect at the instant of its own date.
 */
export function hasTakenEffect(date: Date, at: Date): boolean {
  return date <= at;
}

/** The event in effect at `at`, and the next event, which ends it. */
export function eventInEffectAt<E extends Pick<ActionEvent, "date">>(
  events: E[],
  at: Date,
): { event: E | null; nextEvent: E | null } {
  return {
    event: findLeast(
      events,
      (a, b) => b.date.getTime() - a.date.getTime(), // reverse order
      (candidate) => hasTakenEffect(candidate.date, at),
    ),
    nextEvent: findLeast(
      events,
      (a, b) => a.date.getTime() - b.date.getTime(),
      (candidate) => !hasTakenEffect(candidate.date, at),
    ),
  };
}

/**
 * The member-action phase of an action: the event that opens it and the event
 * that closes it.
 */
export function memberActionPhase(events: ActionEvent[]): MemberActionPhase {
  const event = findLeast(
    events,
    (a, b) => b.date.getTime() - a.date.getTime(), // reverse order
    (event) => event.newStatus === ActionStatus.MemberAction,
  );
  if (!event) {
    return { event: null, deadlineEvent: null };
  }
  return {
    event,
    deadlineEvent: eventInEffectAt(events, event.date).nextEvent,
  };
}

/**
 * Whether a schedule change brings the member-action deadline earlier,
 * including giving a deadline to a phase that had none.
 */
export function shortensMemberActionDeadline(
  before: MemberActionPhase,
  after: MemberActionPhase,
): boolean {
  if (!after.deadlineEvent) return false;
  return (
    !before.deadlineEvent ||
    after.deadlineEvent.date < before.deadlineEvent.date
  );
}
