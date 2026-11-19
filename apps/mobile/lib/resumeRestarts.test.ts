import { renderHook } from "@testing-library/react";
import { expect, it } from "bun:test";
import {
  blockResumeRestart,
  shouldResumeRestart,
  useBlockResumeRestart,
} from "./resumeRestarts";

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
  const ready = { isUpdatePending: true, inputFocused: false };
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
