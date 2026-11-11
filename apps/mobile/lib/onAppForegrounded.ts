import type { AppStateStatic } from "react-native";

/**
 * Calls back on a `background` -> `active` change. Unlike `onAppActive`, it
 * skips iOS's `inactive` -> `active` bounce (Notification Center, the app
 * switcher, an incoming call), which never leaves the foreground. Android
 * reports any Activity pause as `background`, so closing a permission dialog,
 * share sheet or picker still counts there.
 */
export function onAppForegrounded(
  appState: Pick<AppStateStatic, "addEventListener" | "currentState">,
  callback: () => void,
): () => void {
  let previous = appState.currentState;
  const subscription = appState.addEventListener("change", (state) => {
    if (state === "active" && previous === "background") callback();
    previous = state;
  });
  return () => subscription.remove();
}
