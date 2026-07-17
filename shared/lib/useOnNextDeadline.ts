import { useEffect, useMemo, useRef, useState } from "react";

const MAX_INT32 = 2 ** 31 - 1;

/**
 * Milliseconds until the soonest timestamp strictly after `now`, or null when
 * none is in the future. Pure core of the timer hooks below.
 */
export function msUntilNextTimestamp(
  timestamps: (number | null | undefined)[],
  now: number,
): number | null {
  const future = timestamps.filter((t): t is number => t != null && t > now);
  if (future.length === 0) {
    return null;
  }
  return Math.min(...future) - now;
}

/**
 * Fires `onPassed` when the soonest *future* timestamp passes, then re-arms
 * for the next one. No-op when every timestamp is already in the past.
 *
 * `timestamps` and `onPassed` are effect dependencies — memoize both (e.g.
 * via `useMemo`/`useCallback`) or the timer re-arms on every render.
 */
function useOnNextTimestamp(
  timestamps: (number | null | undefined)[] | undefined,
  onPassed: () => void,
): void {
  // Bumped to re-run the effect (and re-arm the timer)
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!timestamps?.length) return;
    const remainingMs = msUntilNextTimestamp(timestamps, Date.now());
    if (remainingMs === null) return;
    // setTimeout stores its delay in a 32-bit signed int; a delay past ~24.8
    // days overflows and fires almost immediately, so cap the wait.
    const overflow = remainingMs > MAX_INT32;
    const timeoutId = setTimeout(
      () => {
        if (!overflow) onPassed();
        setTick((t) => t + 1);
      },
      overflow ? MAX_INT32 : remainingMs,
    );
    return () => clearTimeout(timeoutId);
  }, [timestamps, onPassed, tick]);
}

/**
 * Schedules `onDeadlinePassed` to fire when the soonest *future* member-action
 * deadline passes, so "next task due" rolls forward (a passed deadline becomes
 * "missed" server-side) without the user leaving and returning. No-op when
 * every deadline is already in the past.
 *
 * Pass a memoized `onDeadlinePassed` (e.g. via `useCallback`) — its identity is
 * an effect dependency, so an unstable callback reschedules the timer on every
 * render.
 */
export function useOnNextDeadline(
  actions: { memberActionDeadline?: number | null }[] | undefined,
  onDeadlinePassed: () => void,
): void {
  const timestamps = useMemo(
    () => actions?.map((action) => action.memberActionDeadline),
    [actions],
  );
  useOnNextTimestamp(timestamps, onDeadlinePassed);
}

/**
 * Refetch delay past each event boundary: the client clock can run ahead of
 * the server's, and a refetch that races a server still on the old side of
 * the boundary pins the stale answer (the timer never re-arms for a past
 * timestamp). Firing a little late costs nothing.
 */
export const EVENT_REFETCH_SKEW_MS = 1_500;

/** The instants at which `useOnNextActionEvent` refetches, skew included. */
export function actionEventRefetchTimestamps(
  action: { events: { date: string }[] } | null,
): number[] {
  return (action?.events ?? []).map(
    (event) => new Date(event.date).getTime() + EVENT_REFETCH_SKEW_MS,
  );
}

/**
 * Retry schedule for boundary refetches whose payload came back still on the
 * old side of the boundary (see {@link actionStatusReflectsPastEvents}).
 * Escalating gaps tolerate client clocks up to ~a minute fast; beyond that we
 * stop rather than poll a clock that may be arbitrarily wrong.
 */
export const STALE_EVENT_RETRY_DELAYS_MS = [5_000, 15_000, 45_000] as const;

type ActionWithEventBoundaries = {
  status: string;
  events: { date: string; newStatus: string }[];
};

/**
 * Does this payload acknowledge every event boundary the client clock says
 * has passed (skew buffer included)?
 *
 * `action.status` is derived server-side as "the `newStatus` of the latest
 * *past* event" (`Action#status`), so when the client clock runs more than
 * {@link EVENT_REFETCH_SKEW_MS} ahead of the server's, a boundary-triggered
 * refetch can return a payload still carrying the previous status — and since
 * the timer never re-arms for a client-past timestamp, that stale answer
 * would otherwise pin until navigation.
 *
 * Optimistic on ambiguity: when several events share a `newStatus` (a
 * re-scheduled phase), the payload is matched to the latest of them, and a
 * server *ahead* of the client (client clock slow) counts as acknowledged.
 * False "acknowledged" degrades to the pre-retry behavior; false "stale" would
 * poll, which is worse.
 */
export function actionStatusReflectsPastEvents(
  action: ActionWithEventBoundaries,
  now: number,
): boolean {
  const events = [...action.events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  // The boundaries the refetch timer has already fired for.
  let lastClientPast = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (new Date(events[i].date).getTime() + EVENT_REFETCH_SKEW_MS <= now) {
      lastClientPast = i;
      break;
    }
  }
  if (lastClientPast === -1) {
    return true;
  }
  // The server's implied position: the latest event whose newStatus the
  // payload reports. -1 (no match, e.g. a draft payload) reads as "before
  // every event".
  let serverAt = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].newStatus === action.status) {
      serverAt = i;
      break;
    }
  }
  return serverAt >= lastClientPast;
}

/**
 * Fires `onEventPassed` as each scheduled event on `action` passes — e.g. the
 * member-action phase opening, or the deadline event closing it. The action
 * payload is fetch-time data (`status`, `viewer.*` are computed server-side at
 * response time), so callers should refetch it here to keep time-gated UI
 * (task-form unlock, deadline states) live while the page stays mounted.
 *
 * If a refetched payload still shows a client-past boundary un-crossed — the
 * client clock more than the skew buffer ahead of the server's — fires
 * `onEventPassed` again on the {@link STALE_EVENT_RETRY_DELAYS_MS} schedule
 * until the payload catches up or the budget runs out.
 *
 * Pass a memoized `onEventPassed` — same re-arm caveat as
 * {@link useOnNextDeadline}.
 */
export function useOnNextActionEvent(
  action: ActionWithEventBoundaries | null,
  onEventPassed: () => void,
): void {
  const timestamps = useMemo(
    () => actionEventRefetchTimestamps(action),
    [action],
  );
  useOnNextTimestamp(timestamps, onEventPassed);

  // Bumped after each retry attempt so the next one schedules even when the
  // refetch failed silently and `action` kept its identity.
  const [retryTick, setRetryTick] = useState(0);
  const retryAttempts = useRef(0);
  useEffect(() => {
    if (!action) return;
    if (actionStatusReflectsPastEvents(action, Date.now())) {
      retryAttempts.current = 0;
      return;
    }
    const delay = STALE_EVENT_RETRY_DELAYS_MS[retryAttempts.current];
    if (delay === undefined) return; // budget spent — stale until navigation
    const timeoutId = setTimeout(() => {
      retryAttempts.current += 1;
      setRetryTick((t) => t + 1);
      onEventPassed();
    }, delay);
    return () => clearTimeout(timeoutId);
  }, [action, onEventPassed, retryTick]);
}
