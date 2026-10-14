import type { AppStateStatic } from "react-native";

export function onAppActive(
  appState: Pick<AppStateStatic, "addEventListener">,
  callback: () => void,
): () => void {
  const subscription = appState.addEventListener("change", (state) => {
    if (state === "active") callback();
  });
  return () => subscription.remove();
}
