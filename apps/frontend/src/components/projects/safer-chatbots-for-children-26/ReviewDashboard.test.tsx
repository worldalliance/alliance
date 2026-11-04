import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { REMIND_ME_KEY, ROTATE_MS, ReviewDashboard } from "./ReviewDashboard";

const heading = () => screen.getByRole("heading", { level: 2 }).textContent;

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

test("clicking a category shows it and pauses rotation", () => {
  render(<ReviewDashboard />);
  expect(heading()).toBe("Privacy and personal data");

  act(() => jest.advanceTimersByTime(ROTATE_MS));
  expect(heading()).toBe("Thinking for themselves");

  const chip = screen.getByRole("button", { name: "Homework honesty" });
  fireEvent.click(chip);
  expect(heading()).toBe("Homework honesty");
  expect(chip.getAttribute("aria-current")).toBe("true");
  expect(screen.getByText("Do the work for them to hand in.")).toBeTruthy();

  act(() => jest.advanceTimersByTime(ROTATE_MS * 3));
  expect(heading()).toBe("Homework honesty");
});

test("clicking the current category pauses, and again plays", () => {
  render(<ReviewDashboard />);
  const current = () =>
    screen.getByRole("button", { name: "Privacy and personal data" });

  fireEvent.click(current());
  act(() => jest.advanceTimersByTime(ROTATE_MS * 2));
  expect(heading()).toBe("Privacy and personal data");

  fireEvent.click(current());
  act(() => jest.advanceTimersByTime(ROTATE_MS));
  expect(heading()).toBe("Thinking for themselves");
});

test("only one copy of each category is exposed", () => {
  render(<ReviewDashboard />);
  expect(
    screen.getAllByRole("button", { name: "Homework honesty" }),
  ).toHaveLength(1);
});

test("remind me defaults on and remembers being turned off", () => {
  const { unmount } = render(<ReviewDashboard />);
  const toggle = screen.getByRole("switch", { name: "Remind me" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");

  fireEvent.click(toggle);
  expect(localStorage.getItem(REMIND_ME_KEY)).toBe("false");
  unmount();

  render(<ReviewDashboard />);
  expect(
    screen
      .getByRole("switch", { name: "Remind me" })
      .getAttribute("aria-checked"),
  ).toBe("false");
});
