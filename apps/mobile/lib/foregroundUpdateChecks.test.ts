import { expect, it, mock } from "bun:test";
import { fakeAppState } from "./fakeAppState";
import {
  FOREGROUND_CHECK_INTERVAL_MS,
  startForegroundUpdateChecks,
} from "./foregroundUpdateChecks";

const setup = () => {
  const { appState, change } = fakeAppState();
  let time = 0;
  let finish = () => {};
  const check = mock(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const stop = startForegroundUpdateChecks({
    appState,
    check,
    now: () => time,
  });
  return {
    check,
    stop,
    foreground: () => {
      change("background");
      change("active");
    },
    advance: (ms: number) => {
      time += ms;
    },
    finish: async () => {
      finish();
      await Promise.resolve();
    },
  };
};

it("skips a foreground within the interval of launch", () => {
  const { check, foreground, advance } = setup();
  advance(FOREGROUND_CHECK_INTERVAL_MS - 1);
  foreground();
  expect(check).not.toHaveBeenCalled();
});

it("checks on a foreground once the interval has passed, then waits another", async () => {
  const { check, foreground, advance, finish } = setup();
  advance(FOREGROUND_CHECK_INTERVAL_MS);
  foreground();
  expect(check).toHaveBeenCalledTimes(1);
  await finish();

  advance(FOREGROUND_CHECK_INTERVAL_MS - 1);
  foreground();
  expect(check).toHaveBeenCalledTimes(1);

  advance(1);
  foreground();
  expect(check).toHaveBeenCalledTimes(2);
});

it("doesn't start a second check while one is still running", async () => {
  const { check, foreground, advance, finish } = setup();
  advance(FOREGROUND_CHECK_INTERVAL_MS);
  foreground();
  advance(FOREGROUND_CHECK_INTERVAL_MS);
  foreground();
  expect(check).toHaveBeenCalledTimes(1);

  await finish();
  foreground();
  expect(check).toHaveBeenCalledTimes(2);
});
