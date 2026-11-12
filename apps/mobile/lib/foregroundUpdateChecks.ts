import { milliseconds } from "date-fns";
import type { AppStateStatic } from "react-native";
import { onAppForegrounded } from "./onAppForegrounded";

export const FOREGROUND_CHECK_INTERVAL_MS = milliseconds({ minutes: 15 });

/**
 * Runs `check` when the app returns to the foreground, at most once per
 * interval. The interval starts at the call, because the launch has just run
 * its own startup check.
 */
export function startForegroundUpdateChecks(params: {
  appState: Pick<AppStateStatic, "addEventListener" | "currentState">;
  check: () => Promise<void>;
  now?: () => number;
}): () => void {
  const now = params.now ?? Date.now;
  let lastCheckedAt = now();
  let checking = false;

  return onAppForegrounded(params.appState, () => {
    if (checking || now() - lastCheckedAt < FOREGROUND_CHECK_INTERVAL_MS) {
      return;
    }
    checking = true;
    lastCheckedAt = now();
    void params.check().finally(() => {
      checking = false;
    });
  });
}
