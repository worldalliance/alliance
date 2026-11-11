import { mock } from "bun:test";
import type { AppStateStatus } from "react-native";

export const fakeAppState = (currentState: AppStateStatus = "active") => {
  let listener: (state: AppStateStatus) => void = () => {};
  const remove = mock(() => {});
  return {
    appState: {
      currentState,
      addEventListener: (_type: "change", next: typeof listener) => {
        listener = next;
        return { remove };
      },
    },
    change: (state: AppStateStatus) => listener(state),
    remove,
  };
};
