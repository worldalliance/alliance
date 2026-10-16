import { maxBy, minBy, partition } from "es-toolkit";

/**
 * Each event is in effect over `[its date, the next event's date)`, so an event
 * has taken effect at the instant of its own date.
 */
export function hasTakenEffect(date: Date | string, at: Date): boolean {
  return new Date(date) <= at;
}

/** The event in effect at `at`, and the next event, which ends it. */
export function eventInEffectAt<E extends { date: Date | string }>(
  events: E[],
  at: Date,
): { event: E | null; nextEvent: E | null } {
  const time = (event: E) => new Date(event.date).getTime();
  const [taken, upcoming] = partition(events, (event) =>
    hasTakenEffect(event.date, at),
  );
  return {
    event: maxBy(taken, time) ?? null,
    nextEvent: minBy(upcoming, time) ?? null,
  };
}

export type MemberActionPhase<E> =
  | { event: E; deadlineEvent: E | null }
  | { event: null; deadlineEvent: null };

/**
 * The member-action phase of an action: the event that opens it and the event
 * that closes it.
 */
export function memberActionPhase<
  E extends { date: Date | string; newStatus: string },
>(events: E[]): MemberActionPhase<E> {
  const event = events.find((event) => event.newStatus === "member_action");
  if (!event) {
    return { event: null, deadlineEvent: null };
  }
  return {
    event,
    deadlineEvent: eventInEffectAt(events, new Date(event.date)).nextEvent,
  };
}

/** The member-action event, once it has taken effect. */
export function findStartedMemberActionEvent<
  E extends { date: Date | string; newStatus: string },
>(events: E[], now: Date): E | undefined {
  return events.find(
    (event) =>
      event.newStatus === "member_action" && hasTakenEffect(event.date, now),
  );
}

/** Has a member-action phase opened? See {@link findStartedMemberActionEvent}. */
export function hasMemberActionStarted(
  events: { date: Date | string; newStatus: string }[],
  now: Date,
): boolean {
  return findStartedMemberActionEvent(events, now) !== undefined;
}
