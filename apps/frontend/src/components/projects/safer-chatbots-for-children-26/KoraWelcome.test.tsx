import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, jest, spyOn, test } from "bun:test";
import {
  KoraViewer,
  KoraWelcome,
  REMIND_ME_KEY,
  ROTATE_MS,
} from "./KoraWelcome";

declare const happyDOM: {
  settings: { device: { prefersReducedMotion: string } };
};

const heading = () => screen.getByRole("heading", { level: 2 }).textContent;

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

test("clicking a category shows it and pauses rotation", () => {
  render(<KoraWelcome viewer={KoraViewer.Participant} account={null} />);
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
  render(<KoraWelcome viewer={KoraViewer.Participant} account={null} />);
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
  render(<KoraWelcome viewer={KoraViewer.Participant} account={null} />);
  expect(
    screen.getAllByRole("button", { name: "Homework honesty" }),
  ).toHaveLength(1);
});

test("remind me defaults on and remembers being turned off", () => {
  const { unmount } = render(
    <KoraWelcome viewer={KoraViewer.Participant} account={null} />,
  );
  const toggle = screen.getByRole("switch", { name: "Remind me" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");

  fireEvent.click(toggle);
  expect(localStorage.getItem(REMIND_ME_KEY)).toBe("false");
  unmount();

  render(<KoraWelcome viewer={KoraViewer.Participant} account={null} />);
  expect(
    screen
      .getByRole("switch", { name: "Remind me" })
      .getAttribute("aria-checked"),
  ).toBe("false");
});

test("a participant is thanked for joining the waitlist", () => {
  render(<KoraWelcome viewer={KoraViewer.Participant} account={null} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Thank you for joining the waitlist",
  );
  expect(screen.getByText(/^Our partner,/).textContent).toStartWith(
    "Our partner, KoraBench, needs human reviewers",
  );
  expect(
    screen.getByText(
      "We’ll notify you when the reviews are ready for your input.",
    ),
  ).toBeTruthy();
});

test("a member gets the member heading and a reminder they can't turn off", () => {
  localStorage.setItem(REMIND_ME_KEY, "false");
  render(<KoraWelcome viewer={KoraViewer.Member} account={null} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Alliance members will help shape how children interact with AI chatbots",
  );
  expect(
    screen.getByText(
      "Alliance members will be notified when the reviews launch.",
    ),
  ).toBeTruthy();

  const toggle = screen.getByRole("switch", { name: "Remind me" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(toggle.hasAttribute("disabled")).toBe(true);
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
});

test("focusing a chip by keyboard shows it and pauses rotation", () => {
  render(<KoraWelcome viewer={KoraViewer.Participant} account={null} />);
  const chip = screen.getByRole("button", { name: "Homework honesty" });
  act(() => chip.focus());
  expect(heading()).toBe("Homework honesty");

  act(() => jest.advanceTimersByTime(ROTATE_MS * 2));
  expect(heading()).toBe("Homework honesty");
});

test("focusing the current chip pauses without toggling", () => {
  render(<KoraWelcome viewer={KoraViewer.Participant} account={null} />);
  const current = screen.getByRole("button", {
    name: "Privacy and personal data",
  });
  act(() => current.focus());
  act(() => jest.advanceTimersByTime(ROTATE_MS * 2));
  expect(heading()).toBe("Privacy and personal data");
});

test("with reduced motion, a resumed track keeps a real chip current", () => {
  happyDOM.settings.device.prefersReducedMotion = "reduce";
  try {
    render(<KoraWelcome viewer={KoraViewer.Participant} account={null} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Privacy and personal data" }),
    );
    for (let tick = 0; tick < 25; tick++) {
      act(() => jest.advanceTimersByTime(ROTATE_MS));
    }
    expect(heading()).toBe("Accurate information");
    expect(screen.getByTitle("Pause").getAttribute("aria-hidden")).toBeNull();
  } finally {
    happyDOM.settings.device.prefersReducedMotion = "no-preference";
  }
});

test("a slide that ends past the middle copy jumps back to it", () => {
  const frame = spyOn(window, "requestAnimationFrame").mockImplementation(
    (callback) => window.setTimeout(() => callback(0), 16),
  );
  try {
    render(<KoraWelcome viewer={KoraViewer.Participant} account={null} />);
    act(() => jest.advanceTimersByTime(ROTATE_MS * 10));
    expect(screen.getByTitle("Pause").getAttribute("aria-hidden")).toBe("true");

    fireEvent.transitionEnd(
      screen.getByRole("group", { name: "Choose a category" }),
    );
    expect(heading()).toBe("Privacy and personal data");
    expect(screen.getByTitle("Pause").getAttribute("aria-hidden")).toBeNull();
  } finally {
    frame.mockRestore();
  }
});
