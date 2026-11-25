import { milliseconds } from "date-fns";
import type { AppStateStatic } from "react-native";
import { onAppForegrounded } from "./onAppForegrounded";

export const UPDATE_RECHECK_INTERVAL_MS = milliseconds({ minutes: 5 });

/**
 * Returns a subscribe function whose listeners are called together when the
 * app returns to the foreground and every `UPDATE_RECHECK_INTERVAL_MS` after
 * that return or the first subscription, skipping ticks while the app isn't
 * active, so listeners sharing one search start it once. The timers run only
 * while something is subscribed.
 */
export function createUpdateRechecks(params: {
  appState: Pick<AppStateStatic, "addEventListener" | "currentState">;
  every?: (run: () => void, ms: number) => () => void;
}): (listener: () => void) => () => void {
  const every = params.every ?? setEvery;
  const listeners = new Set<() => void>();
  let stop: (() => void) | null = null;
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const start = () => {
    const startEvery = () =>
      every(() => {
        if (params.appState.currentState === "active") notify();
      }, UPDATE_RECHECK_INTERVAL_MS);
    let stopEvery = startEvery();
    const stopForegrounded = onAppForegrounded(params.appState, () => {
      stopEvery();
      stopEvery = startEvery();
      notify();
    });
    return () => {
      stopEvery();
      stopForegrounded();
    };
  };
  return (listener) => {
    listeners.add(listener);
    stop ??= start();
    return () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      stop?.();
      stop = null;
    };
  };
}

function setEvery(run: () => void, ms: number): () => void {
  const timer = setInterval(run, ms);
  return () => clearInterval(timer);
}
