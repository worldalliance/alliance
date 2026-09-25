import { resetTimeZoneCaches } from "@alliance/shared/forms/timeZoneSelect";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import TimeZoneSelect from "./TimeZoneSelect";

beforeEach(resetTimeZoneCaches);
afterEach(cleanup);

const zoneLabel = (text: string) =>
  screen.getByText(
    (_, element) =>
      element?.children.length === 2 &&
      element.textContent?.replace(/\s+/g, " ") === text,
  );

// getAllByRole reads every row's accessible name, which takes seconds for the
// full list.
const options = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
const spinner = () => document.querySelector('[role="status"] svg');
const trigger = () => screen.getByRole("combobox", { name: /UTC/ });
const searchInput = () =>
  screen.getByRole("combobox", { name: "Search time zones" });
const highlighted = () =>
  options().find((row) => row.hasAttribute("data-highlighted"));
const optionAfter = (row: HTMLElement | undefined) =>
  options()[options().findIndex((option) => option === row) + 1];
const londonRow = () =>
  options().find((row) => row.textContent?.includes("London"));

async function openList() {
  fireEvent.click(trigger());
  await waitFor(() => expect(options().length).toBeGreaterThan(0));
}

async function searchFor(query: string) {
  await openList();
  fireEvent.input(searchInput(), {
    target: { value: query },
    inputType: "insertText",
  });
  await waitFor(() => expect(options().length).toBeLessThan(20));
}

it("shows a row's country and offset under its name", async () => {
  render(<TimeZoneSelect />);

  await searchFor("colombo");

  expect(zoneLabel("India Standard Time · Colombo")).toBeDefined();
  expect(screen.getByText("Sri Lanka · UTC+5:30")).toBeDefined();
});

it("sets a row's city apart from its zone name, so a cut name keeps it", async () => {
  render(<TimeZoneSelect />);

  await searchFor("colombo");

  expect(screen.getByText("Colombo")).toBeDefined();
});

it("keeps them on the trigger once the member picks the row", async () => {
  render(<TimeZoneSelect />);

  await searchFor("colombo");
  fireEvent.click(zoneLabel("India Standard Time · Colombo"));

  await waitFor(() => expect(options()[0]).toBeUndefined());
  expect(screen.getByText("Sri Lanka · UTC+5:30")).toBeDefined();
});

it("waits on the trigger while the zones warm, then opens on the member's zone", async () => {
  let pending: IdleRequestCallback | null = null;
  globalThis.requestIdleCallback = (callback) => {
    pending = callback;
    return 1;
  };
  globalThis.cancelIdleCallback = () => {
    pending = null;
  };
  try {
    render(<TimeZoneSelect value="Europe/London" />);
    fireEvent.click(trigger());

    expect(trigger().contains(spinner())).toBe(true);
    expect(options()).toHaveLength(0);

    act(() => pending?.({ didTimeout: false, timeRemaining: () => Infinity }));

    await waitFor(() =>
      expect(highlighted()?.textContent).toBe(londonRow()?.textContent),
    );
    expect(spinner()).toBeNull();
  } finally {
    resetTimeZoneCaches();
    Reflect.deleteProperty(globalThis, "requestIdleCallback");
    Reflect.deleteProperty(globalThis, "cancelIdleCallback");
  }
});

it.each([
  ["Escape", () => fireEvent.keyDown(trigger(), { key: "Escape" })],
  ["focus leaving", () => fireEvent.blur(trigger())],
  ["a second click", () => fireEvent.click(trigger())],
  [
    "a second press",
    () => {
      fireEvent.pointerDown(trigger(), { pointerType: "mouse" });
      fireEvent.mouseDown(trigger());
      fireEvent.click(trigger(), { detail: 1 });
    },
  ],
])("cancels an open waiting on the warm-up on %s", (_, cancel) => {
  let pending: IdleRequestCallback | null = null;
  globalThis.requestIdleCallback = (callback) => {
    pending = callback;
    return 1;
  };
  globalThis.cancelIdleCallback = () => {
    pending = null;
  };
  try {
    render(<TimeZoneSelect value="Europe/London" />);
    fireEvent.click(trigger());
    cancel();

    act(() => pending?.({ didTimeout: false, timeRemaining: () => Infinity }));

    expect(options()).toHaveLength(0);
    expect(spinner()).toBeNull();
  } finally {
    resetTimeZoneCaches();
    Reflect.deleteProperty(globalThis, "requestIdleCallback");
    Reflect.deleteProperty(globalThis, "cancelIdleCallback");
  }
});

it("marks the saved zone selected and hands focus back on Escape", async () => {
  const onChange = jest.fn();
  render(<TimeZoneSelect value="Europe/London" onChange={onChange} />);

  await openList();

  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  expect(londonRow()?.getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(searchInput(), { key: "Escape" });
  await waitFor(() => expect(options()).toHaveLength(0));
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  await waitFor(() => expect(document.activeElement).toBe(trigger()));
  expect(onChange).not.toHaveBeenCalled();
});

it("names an unlabelled trigger after its zone", () => {
  render(<TimeZoneSelect value="Europe/London" />);

  expect(
    screen.getByRole("combobox", { name: /^United Kingdom Time · London/ }),
  ).toBeDefined();
});

it("says so when a search matches nothing", async () => {
  render(<TimeZoneSelect />);

  await openList();
  fireEvent.change(searchInput(), { target: { value: "zzzz" } });

  expect(await screen.findByText("No matches")).toBeDefined();
});

describe("on a device in Tokyo", () => {
  const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  beforeEach(() => {
    process.env.TZ = "Asia/Tokyo";
  });
  afterEach(() => {
    process.env.TZ = hostZone;
  });

  it("lists Tokyo first, marked as the device's zone", async () => {
    render(<TimeZoneSelect value="Europe/London" />);

    await openList();
    const device = screen.getByTitle("Device time zone");

    expect(options()[0]?.contains(device)).toBe(true);
    expect(options()[0]?.textContent).toContain("Tokyo");
  });
});

describe("opening the list", () => {
  it("highlights the member's own zone, so Enter keeps it", async () => {
    const onChange = jest.fn();
    render(<TimeZoneSelect value="Europe/London" onChange={onChange} />);

    await openList();

    await waitFor(() =>
      expect(highlighted()?.textContent).toBe(londonRow()?.textContent),
    );
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("Europe/London");
  });

  it("moves the highlight with the arrow keys", async () => {
    const onChange = jest.fn();
    render(<TimeZoneSelect value="Europe/London" onChange={onChange} />);

    await openList();
    await waitFor(() =>
      expect(highlighted()?.textContent).toBe(londonRow()?.textContent),
    );
    const next = optionAfter(londonRow());
    fireEvent.keyDown(searchInput(), { key: "ArrowDown" });

    await waitFor(() =>
      expect(highlighted()?.textContent).toBe(next?.textContent),
    );
  });

  it("highlights the first match once the member searches", async () => {
    render(<TimeZoneSelect value="Europe/London" />);

    await searchFor("colombo");

    await waitFor(() =>
      expect(highlighted()?.textContent).toBe(options()[0]?.textContent),
    );
  });

  it("keeps the keyboard's row when the list scrolls under a still pointer", async () => {
    render(<TimeZoneSelect defaultValue="Europe/London" />);

    await openList();
    await waitFor(() =>
      expect(highlighted()?.textContent).toBe(londonRow()?.textContent),
    );
    const row = londonRow();
    const next = optionAfter(row);
    const still = { clientX: 5, clientY: 5 };
    fireEvent.mouseMove(row!, still);
    fireEvent.keyDown(searchInput(), { key: "ArrowDown" });
    await waitFor(() =>
      expect(highlighted()?.textContent).toBe(next?.textContent),
    );
    fireEvent.mouseMove(row!, still);

    expect(highlighted()?.textContent).toBe(next?.textContent);
  });

  it("keeps the member's zone when a pointer the page never saw move lands on a row", async () => {
    render(<TimeZoneSelect defaultValue="Europe/London" />);

    await openList();
    await waitFor(() =>
      expect(highlighted()?.textContent).toBe(londonRow()?.textContent),
    );
    fireEvent.mouseMove(optionAfter(londonRow()), { clientX: 5, clientY: 5 });

    expect(highlighted()?.textContent).toBe(londonRow()?.textContent);
  });

  it("gives the highlight to the row the pointer moves over", async () => {
    render(<TimeZoneSelect defaultValue="Europe/London" />);

    fireEvent.mouseMove(trigger(), { clientX: 1, clientY: 1 });
    await openList();
    await waitFor(() =>
      expect(highlighted()?.textContent).toBe(londonRow()?.textContent),
    );
    const next = optionAfter(londonRow());
    fireEvent.mouseMove(next, { clientX: 5, clientY: 5 });

    await waitFor(() =>
      expect(highlighted()?.textContent).toBe(next?.textContent),
    );
  });
});
