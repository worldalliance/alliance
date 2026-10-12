import { expect, it, mock } from "bun:test";
import type { AppStateStatus } from "react-native";
import { onAppActive } from "./onAppActive";

const fakeAppState = () => {
  let listener: (state: AppStateStatus) => void = () => {};
  const remove = mock(() => {});
  return {
    appState: {
      addEventListener: (_type: "change", next: typeof listener) => {
        listener = next;
        return { remove };
      },
    },
    change: (state: AppStateStatus) => listener(state),
    remove,
  };
};

it("calls back each time the app becomes active, until stopped", () => {
  const { appState, change, remove } = fakeAppState();
  const callback = mock(() => {});
  const stop = onAppActive(appState, callback);

  change("active");
  change("background");
  change("inactive");
  change("active");
  expect(callback).toHaveBeenCalledTimes(2);

  stop();
  expect(remove).toHaveBeenCalled();
});
