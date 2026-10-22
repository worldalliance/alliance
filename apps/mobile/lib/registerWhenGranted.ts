import type { AppStateStatic } from "react-native";
import { onAppActive } from "./onAppActive";

/**
 * Registers again when push permission turns granted while the app was away,
 * as in the device's settings. Rechecks wait for the first registration,
 * whose permission prompt also brings the app back to the foreground.
 */
export function registerWhenGranted(params: {
  appState: Pick<AppStateStatic, "addEventListener">;
  first: Promise<unknown>;
  readGranted: () => Promise<boolean>;
  register: () => void;
}): () => void {
  let granted: boolean | undefined;
  void params.first
    .finally(async () => {
      granted = await params.readGranted();
    })
    .catch((error: unknown) => console.error(error));
  let stopped = false;
  const stop = onAppActive(params.appState, () => {
    if (granted === undefined) return;
    void params
      .readGranted()
      .then((now) => {
        if (!stopped && !granted && now) params.register();
        granted = now;
      })
      .catch((error: unknown) => console.error(error));
  });
  return () => {
    stopped = true;
    stop();
  };
}
