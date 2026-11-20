import { TIMED_OUT, withTimeout } from "@alliance/common/timeout";
import { milliseconds } from "date-fns";
import { useEffect, useRef } from "react";
import type { AppStateStatic } from "react-native";
import { onAppForegrounded } from "./onAppForegrounded";

export const RESUME_RESTART_MIN_BACKGROUND_MS = milliseconds({ minutes: 30 });

// Timers left pending at suspension, such as the 300 ms form draft save, have
// earlier deadlines, so they fire before the restart.
const RESUME_RESTART_DELAY_MS = 1000;

// Long enough for a check that finds nothing new; a download that outlasts it
// applies on a later return instead of cutting into what the member has
// started reading.
const RESUME_RESTART_SETTLE_DEADLINE_MS = milliseconds({ seconds: 5 });

let actions = 0;

function noteMemberAction(): void {
  actions++;
}

/**
 * For the app's root view: a touch or press anywhere in the app after a return
 * holds off its restart. Android delivers a screen reader's or hardware key's
 * press as a click with no touch, and a nested pressable stops the click
 * bubbling, so it is caught on capture.
 */
export const memberActionHandlers = {
  onTouchStart: noteMemberAction,
  onClickCapture: noteMemberAction,
};

/**
 * Calls `restart` shortly after the app returns from at least
 * `RESUME_RESTART_MIN_BACKGROUND_MS` in the background, if the app hasn't left
 * the active state, the member hasn't acted, and `shouldRestart` says so, both
 * before and after awaiting `settle`, and `screenReaderEnabled` resolves false.
 * Both must end within the settle deadline.
 */
export function startResumeRestarts(params: {
  appState: Pick<AppStateStatic, "addEventListener" | "currentState">;
  shouldRestart: () => boolean;
  /** Never rejects. */
  settle: () => Promise<unknown>;
  screenReaderEnabled: () => Promise<boolean>;
  restart: () => void;
  now?: () => number;
  delayMs?: number;
  settleDeadlineMs?: number;
}): () => void {
  const now = params.now ?? Date.now;
  let backgroundedAt: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let returns = 0;
  const cancel = () => {
    returns++;
    clearTimeout(timer);
  };
  const subscription = params.appState.addEventListener("change", (state) => {
    if (state !== "active") cancel();
    if (state === "background") backgroundedAt = now();
  });
  const stopForegrounded = onAppForegrounded(params.appState, () => {
    if (
      backgroundedAt === null ||
      now() - backgroundedAt < RESUME_RESTART_MIN_BACKGROUND_MS
    ) {
      return;
    }
    const thisReturn = ++returns;
    const actionsAtReturn = actions;
    const stillWanted = () =>
      returns === thisReturn &&
      actions === actionsAtReturn &&
      params.shouldRestart();
    timer = setTimeout(() => {
      if (!stillWanted()) return;
      void withTimeout(
        Promise.all([params.settle(), params.screenReaderEnabled()]),
        params.settleDeadlineMs ?? RESUME_RESTART_SETTLE_DEADLINE_MS,
      ).then((settled) => {
        if (settled === TIMED_OUT) return;
        const [, screenReaderOn] = settled;
        if (!screenReaderOn && stillWanted()) params.restart();
      });
    }, params.delayMs ?? RESUME_RESTART_DELAY_MS);
  });
  return () => {
    subscription.remove();
    stopForegrounded();
    cancel();
  };
}

/**
 * Runs `startResumeRestarts` while mounted and `enabled`, deciding and
 * restarting with the latest render's `isUpdatePending` and `route`.
 */
export function useResumeRestarts(
  params: Omit<
    Parameters<typeof startResumeRestarts>[0],
    "shouldRestart" | "restart"
  > & {
    enabled: boolean;
    isUpdatePending: boolean;
    route: string;
    inputFocused: () => boolean;
    restart: (route: string) => void;
  },
): void {
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  });
  const { enabled } = params;
  useEffect(() => {
    if (!enabled) return;
    const {
      appState,
      settle,
      screenReaderEnabled,
      now,
      delayMs,
      settleDeadlineMs,
    } = latest.current;
    return startResumeRestarts({
      appState,
      settle,
      screenReaderEnabled,
      now,
      delayMs,
      settleDeadlineMs,
      shouldRestart: () =>
        shouldResumeRestart({
          isUpdatePending: latest.current.isUpdatePending,
          inputFocused: latest.current.inputFocused(),
        }),
      restart: () => latest.current.restart(latest.current.route),
    });
  }, [enabled]);
}

let blockers = 0;

/**
 * Keeps automatic restarts off until the returned function runs, while
 * something a restart would lose is under way.
 */
export function blockResumeRestart(): () => void {
  blockers++;
  return () => {
    blockers--;
  };
}

// React Native's Android HTTP client sets no timeout, so a stalled request
// would otherwise hold restarts off for the rest of the process.
const BLOCK_UNTIL_DEADLINE_MS = milliseconds({ seconds: 30 });

/**
 * Keeps automatic restarts off until `work` settles, or `deadlineMs` passes.
 */
export function blockResumeRestartUntil(
  work: Promise<unknown>,
  deadlineMs = BLOCK_UNTIL_DEADLINE_MS,
): void {
  void withTimeout(Promise.allSettled([work]), deadlineMs).finally(
    blockResumeRestart(),
  );
}

/**
 * Wraps the API client's `fetch` so each request that changes data, which a
 * restart would cut off, keeps automatic restarts off while it is in flight.
 */
export function blockResumeRestartDuringWrites(
  fetch: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return (request) => {
    const response = fetch(request);
    if (request.method !== "GET") blockResumeRestartUntil(response);
    return response;
  };
}

/**
 * Blocks automatic restarts while `active`: set it while a screen or sheet
 * holds unsaved input it keeps only in memory.
 */
export function useBlockResumeRestart(active: boolean): void {
  useEffect(() => (active ? blockResumeRestart() : undefined), [active]);
}

// The focus check covers a screen that holds input without blocking.
export function shouldResumeRestart(params: {
  isUpdatePending: boolean;
  inputFocused: boolean;
}): boolean {
  return params.isUpdatePending && !params.inputFocused && blockers === 0;
}
