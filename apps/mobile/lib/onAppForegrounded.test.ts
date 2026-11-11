import { expect, it, mock } from "bun:test";
import { fakeAppState } from "./fakeAppState";
import { onAppForegrounded } from "./onAppForegrounded";

it("calls back on each return from the background, until stopped", () => {
  const { appState, change, remove } = fakeAppState();
  const callback = mock(() => {});
  const stop = onAppForegrounded(appState, callback);

  change("inactive");
  change("background");
  change("active");
  change("background");
  change("active");
  expect(callback).toHaveBeenCalledTimes(2);

  stop();
  expect(remove).toHaveBeenCalled();
});

it("skips an inactive bounce that never leaves the foreground", () => {
  const { appState, change } = fakeAppState();
  const callback = mock(() => {});
  onAppForegrounded(appState, callback);

  change("inactive");
  change("active");
  expect(callback).not.toHaveBeenCalled();
});

it("counts a launch into the background as the starting state", () => {
  const { appState, change } = fakeAppState("background");
  const callback = mock(() => {});
  onAppForegrounded(appState, callback);

  change("active");
  expect(callback).toHaveBeenCalledTimes(1);
});
