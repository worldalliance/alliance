import { findLeast } from "src/utils/filter";
import { ActionEvent, ActionStatus } from "../entities/action-event.entity";

export type MemberActionPhase =
  | {
      event: ActionEvent;
      deadlineEvent: ActionEvent | null;
    }
  | { event: null; deadlineEvent: null };

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
  const deadlineEvent =
    findLeast(
      events,
      (a, b) => a.date.getTime() - b.date.getTime(),
      (candidate) => candidate.date > event.date,
    ) ?? null;
  return { event, deadlineEvent };
}
