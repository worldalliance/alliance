import { expect, it, mock } from "bun:test";
import { fakeAppState } from "./fakeAppState";
import { onAppActive } from "./onAppActive";

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
