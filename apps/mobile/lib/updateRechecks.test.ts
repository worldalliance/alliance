import { expect, it, mock } from "bun:test";
import { fakeAppState } from "./fakeAppState";
import {
  createUpdateRechecks,
  UPDATE_RECHECK_INTERVAL_MS,
} from "./updateRechecks";

const setup = () => {
  const fake = fakeAppState();
  const ticks = new Set<() => void>();
  const every = mock((run: () => void, _ms: number) => {
    ticks.add(run);
    return () => ticks.delete(run);
  });
  const subscribe = createUpdateRechecks({ appState: fake.appState, every });
  const tick = () => {
    for (const run of ticks) run();
  };
  return { ...fake, every, subscribe, tick, ticks };
};

it("calls every listener on each interval and on a return to the foreground", () => {
  const { subscribe, tick, change, every } = setup();
  const first = mock(() => {});
  const second = mock(() => {});
  subscribe(first);
  subscribe(second);
  expect(every).toHaveBeenCalledTimes(1);
  expect(every.mock.calls[0]?.[1]).toBe(UPDATE_RECHECK_INTERVAL_MS);
  tick();
  change("background");
  change("active");
  expect(first).toHaveBeenCalledTimes(2);
  expect(second).toHaveBeenCalledTimes(2);
});

it("restarts the interval on a return to the foreground", () => {
  const { subscribe, ticks, change, every } = setup();
  subscribe(() => {});
  const before = new Set(ticks);
  change("background");
  change("active");
  expect(every).toHaveBeenCalledTimes(2);
  expect(ticks.size).toBe(1);
  expect([...ticks].some((run) => before.has(run))).toBe(false);
});

it("skips an interval that fires while the app isn't active", () => {
  const { subscribe, tick, appState } = setup();
  const listener = mock(() => {});
  subscribe(listener);
  appState.currentState = "background";
  tick();
  expect(listener).not.toHaveBeenCalled();
});

it("stops its timer and listener once the last subscriber leaves, and restarts them", () => {
  const { subscribe, tick, ticks, change, every } = setup();
  const listener = mock(() => {});
  const unsubscribeFirst = subscribe(listener);
  const unsubscribeSecond = subscribe(() => {});
  unsubscribeFirst();
  expect(ticks.size).toBe(1);
  unsubscribeSecond();
  expect(ticks.size).toBe(0);
  change("background");
  change("active");
  expect(listener).not.toHaveBeenCalled();
  subscribe(listener);
  expect(every).toHaveBeenCalledTimes(2);
  tick();
  expect(listener).toHaveBeenCalledTimes(1);
});
