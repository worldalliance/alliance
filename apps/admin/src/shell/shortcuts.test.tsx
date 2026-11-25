import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, jest, mock } from "bun:test";
import {
  ShortcutsProvider,
  useOpenShortcutList,
  useShortcut,
} from "./shortcuts";

const platform = navigator.platform;
const setPlatform = (value: string) =>
  Object.defineProperty(navigator, "platform", { value, configurable: true });

beforeEach(() => {
  window.localStorage.clear();
  setPlatform("Win32");
});
afterEach(() => {
  setPlatform(platform);
  jest.useRealTimers();
});

const Bound = ({
  onBracket,
  onGoTasks,
  onPalette,
}: {
  onBracket: () => void;
  onGoTasks: () => void;
  onPalette: () => void;
}) => {
  useShortcut({ keys: "[", label: "Collapse", global: true, run: onBracket });
  useShortcut({
    keys: "g t",
    label: "Go to Tasks",
    global: true,
    run: onGoTasks,
  });
  useShortcut({
    keys: "mod+k",
    label: "Open search",
    global: true,
    run: onPalette,
  });
  useShortcut({ keys: "e", label: "Edit this record", run: () => {} });
  const openList = useOpenShortcutList();
  useShortcut({
    keys: "?",
    label: "Show shortcuts",
    global: true,
    run: openList,
  });
  return (
    <>
      <input aria-label="Name" />
      <button type="button" onClick={openList}>
        Keyboard shortcuts
      </button>
    </>
  );
};

const renderBound = () => {
  const calls = { onBracket: mock(), onGoTasks: mock(), onPalette: mock() };
  render(
    <ShortcutsProvider>
      <Bound {...calls} />
    </ShortcutsProvider>,
  );
  return calls;
};

it("runs a single key, and a sequence only when its keys follow each other", () => {
  const calls = renderBound();

  fireEvent.keyDown(window, { key: "[" });
  expect(calls.onBracket).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(window, { key: "t" });
  expect(calls.onGoTasks).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "g" });
  fireEvent.keyDown(window, { key: "t" });
  expect(calls.onGoTasks).toHaveBeenCalledTimes(1);
});

it("leaves single keys alone while typing, but not Ctrl+K", () => {
  const calls = renderBound();
  const input = screen.getByRole("textbox", { name: "Name" });

  fireEvent.keyDown(input, { key: "[" });
  expect(calls.onBracket).not.toHaveBeenCalled();

  fireEvent.keyDown(input, { key: "k", ctrlKey: true });
  expect(calls.onPalette).toHaveBeenCalledTimes(1);
});

it("takes only the platform's own modifier", () => {
  const calls = renderBound();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  expect(calls.onPalette).not.toHaveBeenCalled();

  setPlatform("MacIntel");
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(calls.onPalette).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  expect(calls.onPalette).toHaveBeenCalledTimes(1);
});

it("takes a key a layout types with AltGr or Option, but not one pressed with Alt", () => {
  const calls = renderBound();

  fireEvent.keyDown(window, { key: "[", altKey: true });
  expect(calls.onBracket).not.toHaveBeenCalled();

  fireEvent.keyDown(window, { key: "[", ctrlKey: true, altKey: true });
  expect(calls.onBracket).toHaveBeenCalledTimes(1);

  setPlatform("MacIntel");
  fireEvent.keyDown(window, { key: "[", altKey: true });
  expect(calls.onBracket).toHaveBeenCalledTimes(2);
});

it("reads a letter typed with Caps Lock on, and ignores a held key", () => {
  const calls = renderBound();

  fireEvent.keyDown(window, { key: "G" });
  fireEvent.keyDown(window, { key: "T" });
  expect(calls.onGoTasks).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(window, { key: "[", repeat: true });
  expect(calls.onBracket).not.toHaveBeenCalled();
});

it("tries a key that doesn't continue a sequence on its own", () => {
  const calls = renderBound();

  fireEvent.keyDown(window, { key: "g" });
  fireEvent.keyDown(window, { key: "[" });

  expect(calls.onBracket).toHaveBeenCalledTimes(1);
  expect(calls.onGoTasks).not.toHaveBeenCalled();
});

it("forgets the start of a sequence after a second", () => {
  jest.useFakeTimers();
  const calls = renderBound();

  fireEvent.keyDown(window, { key: "g" });
  jest.advanceTimersByTime(1000);
  fireEvent.keyDown(window, { key: "t" });

  expect(calls.onGoTasks).not.toHaveBeenCalled();
});

it("leaves single keys to an open dialog", async () => {
  const calls = renderBound();

  fireEvent.keyDown(window, { key: "?" });
  await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
  fireEvent.keyDown(window, { key: "[" });

  expect(calls.onBracket).not.toHaveBeenCalled();
});

it("leaves a browser shortcut that shares a letter alone", () => {
  const calls = renderBound();

  fireEvent.keyDown(window, { key: "t", metaKey: true });
  fireEvent.keyDown(window, { key: "g" });
  fireEvent.keyDown(window, { key: "t", ctrlKey: true });
  fireEvent.keyDown(window, { key: "t" });

  expect(calls.onGoTasks).not.toHaveBeenCalled();
});

it("lists every shortcut under ?, a page's own apart from the shell's", async () => {
  renderBound();

  fireEvent.keyDown(window, { key: "?" });
  const dialog = await screen.findByRole("dialog", {
    name: "Keyboard shortcuts",
  });

  expect(
    [...dialog.querySelectorAll("section")].map((section) => [
      section.querySelector("h3")?.textContent,
      [...section.querySelectorAll("li > span:first-child")].map(
        (label) => label.textContent,
      ),
    ]),
  ).toEqual([
    ["This page", ["Edit this record"]],
    ["Anywhere", ["Collapse", "Go to Tasks", "Open search", "Show shortcuts"]],
  ]);
});

it("turns single-key shortcuts off, keeps that across a reload, and still lists them from a menu", async () => {
  const first = renderBound();
  fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
  fireEvent.click(
    await screen.findByRole("switch", { name: /Single-key shortcuts/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  fireEvent.keyDown(window, { key: "[" });
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(first.onBracket).not.toHaveBeenCalled();
  expect(first.onPalette).toHaveBeenCalledTimes(1);

  const second = renderBound();
  fireEvent.keyDown(window, { key: "[" });
  expect(second.onBracket).not.toHaveBeenCalled();
});

it.each([
  ["e", "e", 'shortcut e is already "Edit"; "Export" needs other keys than e'],
  [
    "g t",
    "g",
    'shortcut g t is already "Edit"; "Export" needs other keys than g',
  ],
  [
    "g",
    "g t",
    'shortcut g is already "Edit"; "Export" needs other keys than g t',
  ],
])(
  "refuses %p beside %p, since one would hide the other",
  (first, second, message) => {
    const Clash = () => {
      useShortcut({ keys: first, label: "Edit", run: () => {} });
      useShortcut({ keys: second, label: "Export", run: () => {} });
      return null;
    };
    const error = console.error;
    console.error = () => {};
    try {
      expect(() =>
        render(
          <ShortcutsProvider>
            <Clash />
          </ShortcutsProvider>,
        ),
      ).toThrow(message);
    } finally {
      console.error = error;
    }
  },
);
