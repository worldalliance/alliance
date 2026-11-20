import { renderHook } from "@testing-library/react";
import { expect, it } from "bun:test";
import {
  blockResumeRestart,
  blockResumeRestartDuringWrites,
  blockResumeRestartUntil,
  shouldResumeRestart,
  useBlockResumeRestart,
} from "./resumeRestarts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
const ready = { isUpdatePending: true, inputFocused: false };

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
  const ready = { isUpdatePending: true, inputFocused: false };
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
