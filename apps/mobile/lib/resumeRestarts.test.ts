import { renderHook } from "@testing-library/react";
import { expect, it, mock } from "bun:test";
import type { AppStateStatus } from "react-native";
import { fakeAppState } from "./fakeAppState";
import {
  blockResumeRestart,
  blockResumeRestartDuringWrites,
  blockResumeRestartUntil,
  memberActionHandlers,
  RESUME_RESTART_MIN_BACKGROUND_MS,
  shouldResumeRestart,
  startResumeRestarts,
  useBlockResumeRestart,
  useResumeRestarts,
} from "./resumeRestarts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
const ready = { isUpdatePending: true, inputFocused: false };

const setup = ({
  shouldRestart = () => true,
  settle = async () => {},
  settleDeadlineMs,
  screenReaderEnabled = async () => false,
}: Partial<
  Pick<
    Parameters<typeof startResumeRestarts>[0],
    "shouldRestart" | "settle" | "settleDeadlineMs" | "screenReaderEnabled"
  >
> = {}) => {
  const { appState, change } = fakeAppState();
  let time = 0;
  const restart = mock(() => {});
  const stop = startResumeRestarts({
    appState,
    shouldRestart,
    settle,
    screenReaderEnabled,
    restart,
    now: () => time,
    delayMs: 0,
    settleDeadlineMs,
  });
  const resumeAfter = (ms: number) => {
    change("background");
    time += ms;
    change("active");
  };
  return { restart, stop, resumeAfter, change };
};

it("restarts on a return from a long background with an update ready", async () => {
  const { restart, resumeAfter } = setup();
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
  await tick();
  expect(restart).toHaveBeenCalledTimes(1);
});

it("leaves a short trip to the background alone", async () => {
  const { restart, resumeAfter } = setup();
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS - 1);
  await tick();
  expect(restart).not.toHaveBeenCalled();
});

it("leaves the app alone with no update ready", async () => {
  const { restart, resumeAfter } = setup({ shouldRestart: () => false });
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
  await tick();
  expect(restart).not.toHaveBeenCalled();
});

it("cancels a scheduled restart once stopped", async () => {
  const { restart, stop, resumeAfter } = setup();
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
  stop();
  await tick();
  expect(restart).not.toHaveBeenCalled();
});

it.each<AppStateStatus>(["inactive", "background"])(
  "cancels a scheduled restart when the app turns %s",
  async (state) => {
    const { restart, resumeAfter, change } = setup();
    resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
    change(state);
    await tick();
    expect(restart).not.toHaveBeenCalled();
  },
);

it("doesn't restart once the member touches the screen after the return", async () => {
  const { restart, resumeAfter } = setup();
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
  memberActionHandlers.onTouchStart();
  await tick();
  expect(restart).not.toHaveBeenCalled();
});

it("doesn't restart once a screen reader or hardware key presses something after the return", async () => {
  const { restart, resumeAfter } = setup();
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
  memberActionHandlers.onClickCapture();
  await tick();
  expect(restart).not.toHaveBeenCalled();
});

it("doesn't restart while a screen reader is on", async () => {
  const { restart, resumeAfter } = setup({
    screenReaderEnabled: async () => true,
  });
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
  await tick();
  expect(restart).not.toHaveBeenCalled();
});

it("reads whether a screen reader is on when the restart fires", async () => {
  let reads = 0;
  const { resumeAfter } = setup({
    screenReaderEnabled: async () => {
      reads++;
      return false;
    },
  });
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
  expect(reads).toBe(0);
  await tick();
  expect(reads).toBe(1);
});

it("doesn't restart when the check under way outlasts its deadline", async () => {
  const check = Promise.withResolvers<void>();
  const { restart, resumeAfter } = setup({
    settle: () => {
      setTimeout(() => check.resolve(), 10);
      return check.promise;
    },
    settleDeadlineMs: 5,
  });
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
  await check.promise;
  await tick();
  expect(restart).not.toHaveBeenCalled();
});

it("waits for a check under way before restarting", async () => {
  const check = Promise.withResolvers<void>();
  const { restart, resumeAfter } = setup({ settle: () => check.promise });
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
  await tick();
  expect(restart).not.toHaveBeenCalled();
  check.resolve();
  await tick();
  expect(restart).toHaveBeenCalledTimes(1);
});

it.each<[string, (change: (state: AppStateStatus) => void) => void]>([
  ["the member touches the screen", () => memberActionHandlers.onTouchStart()],
  ["the app leaves the active state", (change) => change("inactive")],
])(
  "doesn't restart when %s while a check is under way",
  async (_, interrupt) => {
    const check = Promise.withResolvers<void>();
    const { restart, resumeAfter, change } = setup({
      settle: () => check.promise,
    });
    resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
    await tick();
    interrupt(change);
    check.resolve();
    await tick();
    expect(restart).not.toHaveBeenCalled();
  },
);

it.each([
  [true, false, true],
  [false, false, false],
  [true, true, false],
])(
  "with an update pending %p and an input focused %p, restarts: %p",
  (isUpdatePending, inputFocused, restarts) => {
    expect(shouldResumeRestart({ isUpdatePending, inputFocused })).toBe(
      restarts,
    );
  },
);

it("doesn't restart while a screen blocks it", () => {
  const unblock = blockResumeRestart();
  expect(shouldResumeRestart(ready)).toBe(false);
  unblock();
  expect(shouldResumeRestart(ready)).toBe(true);
});

it("blocks restarts while a screen's hook is active and mounted", () => {
  const { rerender, unmount } = renderHook(
    ({ active }) => useBlockResumeRestart(active),
    { initialProps: { active: true } },
  );
  expect(shouldResumeRestart(ready)).toBe(false);
  rerender({ active: false });
  expect(shouldResumeRestart(ready)).toBe(true);
  rerender({ active: true });
  unmount();
  expect(shouldResumeRestart(ready)).toBe(true);
});

it("doesn't restart until the blocking work settles, failing included", async () => {
  const failed = Promise.withResolvers<void>();
  blockResumeRestartUntil(failed.promise);
  await tick();
  expect(shouldResumeRestart(ready)).toBe(false);
  failed.reject(new Error("offline"));
  await tick();
  expect(shouldResumeRestart(ready)).toBe(true);
});

it("stops waiting for a request that never settles once the deadline passes", async () => {
  blockResumeRestartUntil(new Promise(() => {}), 5);
  expect(shouldResumeRestart(ready)).toBe(false);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(shouldResumeRestart(ready)).toBe(true);
});

it("doesn't restart while a request that changes data is in flight", async () => {
  const response = Promise.withResolvers<Response>();
  const fetch = blockResumeRestartDuringWrites(() => response.promise);
  void fetch(new Request("http://api.test/push/opened", { method: "POST" }));
  expect(shouldResumeRestart(ready)).toBe(false);
  response.resolve(new Response());
  await tick();
  expect(shouldResumeRestart(ready)).toBe(true);
});

it("restarts while a request that only reads is in flight", () => {
  const fetch = blockResumeRestartDuringWrites(() => new Promise(() => {}));
  void fetch(new Request("http://api.test/actions"));
  expect(shouldResumeRestart(ready)).toBe(true);
});

it("checks for blockers when the restart fires, not on the return", async () => {
  const { restart, resumeAfter } = setup({
    shouldRestart: () => shouldResumeRestart(ready),
  });
  resumeAfter(RESUME_RESTART_MIN_BACKGROUND_MS);
  const unblock = blockResumeRestart();
  await tick();
  unblock();
  expect(restart).not.toHaveBeenCalled();
});

it("restarts with the update state and route of the latest render", async () => {
  const { appState, change } = fakeAppState();
  let time = 0;
  const restart = mock((_route: string) => {});
  const { rerender } = renderHook(
    (props: { isUpdatePending: boolean; route: string }) =>
      useResumeRestarts({
        enabled: true,
        appState,
        ...props,
        inputFocused: () => false,
        settle: async () => {},
        screenReaderEnabled: async () => false,
        restart,
        now: () => time,
        delayMs: 0,
      }),
    { initialProps: { isUpdatePending: false, route: "/" } },
  );
  rerender({ isUpdatePending: true, route: "/messages" });
  change("background");
  time += RESUME_RESTART_MIN_BACKGROUND_MS;
  change("active");
  await tick();
  expect(restart).toHaveBeenCalledWith("/messages");
});
