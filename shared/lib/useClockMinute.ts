import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

const currentMinute = (): number => Math.floor(Date.now() / MINUTE_MS);

/** The instant a minute names, which is what a clock label formats. */
export const minuteStart = (minute: number): Date =>
  new Date(minute * MINUTE_MS);

const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

// Re-armed off the real clock each time: a fixed period drifts off the
// boundary, and a fire landing a millisecond early would otherwise leave every
// clock a minute behind until the next one. The re-arm goes before the
// notifying so that a subscriber throwing, or leaving mid-loop, cannot strand
// the page with no timer or with one nobody holds the handle to.
function arm(): void {
  timer = setTimeout(
    () => {
      arm();
      for (const notify of subscribers) notify();
    },
    MINUTE_MS - (Date.now() % MINUTE_MS),
  );
}

function subscribe(onMinute: () => void): () => void {
  subscribers.add(onMinute);
  if (timer === null) arm();
  return () => {
    subscribers.delete(onMinute);
    if (subscribers.size === 0 && timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

/** Drops the page timer and its subscribers. For tests. */
export function resetClock(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  subscribers.clear();
}

/**
 * The current minute since the epoch, re-read on each minute boundary.
 *
 * One timer serves the whole page, so a feed of cards each showing a clock
 * flips all of them together rather than each on the minute its own card
 * mounted in.
 */
export function useClockMinute(): number {
  return useSyncExternalStore(subscribe, currentMinute, currentMinute);
}
