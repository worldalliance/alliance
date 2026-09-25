import { resetTimeZoneCaches } from "@alliance/shared/forms/timeZoneSelect";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
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

function searchFor(query: string): void {
  fireEvent.click(screen.getByRole("button"));
  act(() => {
    fireEvent.change(screen.getByPlaceholderText("Search time zones…"), {
      target: { value: query },
    });
  });
}

it("shows a row's country and offset under its name", () => {
  render(<TimeZoneSelect />);

  searchFor("colombo");

  expect(zoneLabel("India Standard Time · Colombo")).toBeDefined();
  expect(screen.getByText("Sri Lanka · UTC+5:30")).toBeDefined();
});

it("sets a row's city apart from its zone name, so a cut name keeps it", () => {
  render(<TimeZoneSelect />);

  searchFor("colombo");

  expect(screen.getByText("Colombo")).toBeDefined();
});

it("keeps them on the trigger once the member picks the row", () => {
  render(<TimeZoneSelect />);

  searchFor("colombo");
  fireEvent.click(zoneLabel("India Standard Time · Colombo"));

  expect(screen.getByText("Sri Lanka · UTC+5:30")).toBeDefined();
});

it("shows a spinner, not an empty list, while the zones warm", () => {
  let pending: IdleRequestCallback | null = null;
  globalThis.requestIdleCallback = (callback) => {
    pending = callback;
    return 1;
  };
  globalThis.cancelIdleCallback = () => {
    pending = null;
  };
  try {
    render(<TimeZoneSelect />);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByText("No matches")).toBeNull();

    act(() => pending?.({ didTimeout: false, timeRemaining: () => Infinity }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(zoneLabel("Japan Standard Time · Tokyo")).toBeDefined();
  } finally {
    resetTimeZoneCaches();
    Reflect.deleteProperty(globalThis, "requestIdleCallback");
    Reflect.deleteProperty(globalThis, "cancelIdleCallback");
  }
});

describe("on a device in Tokyo", () => {
  const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  beforeEach(() => {
    process.env.TZ = "Asia/Tokyo";
  });
  afterEach(() => {
    process.env.TZ = hostZone;
  });

  it("lists Tokyo first, marked as the device's zone", () => {
    render(<TimeZoneSelect value="Europe/London" />);

    fireEvent.click(screen.getByRole("button"));
    const device = screen.getByTitle("Device time zone");

    expect(device.closest("button")?.textContent).toContain("Tokyo");
    expect(device.closest("button")?.parentElement?.firstElementChild).toBe(
      device.closest("button"),
    );
  });
});

describe("opening the list", () => {
  let scrolledTo: Element[] = [];
  beforeEach(() => {
    scrolledTo = [];
    jest
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(function (this: Element) {
        scrolledTo.push(this);
      });
  });
  afterEach(() => jest.restoreAllMocks());

  const londonRow = () =>
    screen
      .getAllByText(/London/)
      .map((el) => el.closest("button"))
      .find((row) => row?.parentElement?.className.includes("overflow-auto"));

  it("brings the member's own zone into view and onto the keyboard", () => {
    const onChange = jest.fn();
    render(<TimeZoneSelect value="Europe/London" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button"));

    expect(scrolledTo.at(-1)?.textContent).toBe(londonRow()?.textContent);
    fireEvent.keyDown(screen.getByPlaceholderText("Search time zones…"), {
      key: "Enter",
    });
    expect(onChange).toHaveBeenCalledWith("Europe/London");
  });

  it("keeps the row the arrow keys reach in view", () => {
    render(<TimeZoneSelect value="Europe/London" />);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(screen.getByPlaceholderText("Search time zones…"), {
      key: "ArrowDown",
    });

    expect(scrolledTo.at(-1)?.textContent).toBe(
      londonRow()?.nextElementSibling?.textContent,
    );
  });

  it("returns to the top of the list once the member searches", () => {
    render(<TimeZoneSelect value="Europe/London" />);

    fireEvent.click(screen.getByRole("button"));
    const list = londonRow()?.parentElement;
    if (!list) throw new Error("list not rendered");
    list.scrollTop = 600;
    fireEvent.change(screen.getByPlaceholderText("Search time zones…"), {
      target: { value: "a" },
    });

    expect(list.scrollTop).toBe(0);
  });

  it("keeps the keyboard's row when the list scrolls under a still pointer", () => {
    render(<TimeZoneSelect defaultValue="Europe/London" />);

    fireEvent.click(screen.getByRole("button"));
    const row = londonRow();
    const nextRow = row?.nextElementSibling;
    if (!row || !nextRow) throw new Error("list not rendered");
    const reached = nextRow.textContent;
    const still = { clientX: 5, clientY: 5 };
    fireEvent.mouseMove(row, still);
    fireEvent.keyDown(screen.getByPlaceholderText("Search time zones…"), {
      key: "ArrowDown",
    });
    fireEvent.mouseEnter(row);
    fireEvent.mouseMove(row, still);
    fireEvent.keyDown(screen.getByPlaceholderText("Search time zones…"), {
      key: "Enter",
    });

    expect(screen.getByRole("button").textContent).toBe(reached);
  });

  it("keeps the member's zone when opening scrolls a row under the pointer", () => {
    render(<TimeZoneSelect defaultValue="Europe/London" />);

    const still = { clientX: 5, clientY: 5 };
    fireEvent.mouseMove(screen.getByRole("button"), still);
    fireEvent.click(screen.getByRole("button"));
    const nextRow = londonRow()?.nextElementSibling;
    if (!nextRow) throw new Error("list not rendered");
    fireEvent.mouseMove(nextRow, still);
    fireEvent.keyDown(screen.getByPlaceholderText("Search time zones…"), {
      key: "Enter",
    });

    expect(screen.getByRole("button").textContent).toContain("London");
  });

  it("keeps the member's zone when a pointer the page never saw move lands on a row", () => {
    render(<TimeZoneSelect defaultValue="Europe/London" />);

    fireEvent.click(screen.getByRole("button"));
    const nextRow = londonRow()?.nextElementSibling;
    if (!nextRow) throw new Error("list not rendered");
    fireEvent.mouseMove(nextRow, { clientX: 5, clientY: 5 });
    fireEvent.keyDown(screen.getByPlaceholderText("Search time zones…"), {
      key: "Enter",
    });

    expect(screen.getByRole("button").textContent).toContain("London");
  });

  it("gives the highlight to the row the pointer moves over", () => {
    render(<TimeZoneSelect defaultValue="Europe/London" />);

    fireEvent.mouseMove(screen.getByRole("button"), { clientX: 1, clientY: 1 });
    fireEvent.click(screen.getByRole("button"));
    const nextRow = londonRow()?.nextElementSibling;
    if (!nextRow) throw new Error("list not rendered");
    const hovered = nextRow.textContent;
    fireEvent.mouseMove(nextRow, { clientX: 5, clientY: 5 });
    fireEvent.keyDown(screen.getByPlaceholderText("Search time zones…"), {
      key: "Enter",
    });

    expect(screen.getByRole("button").textContent).toBe(hovered);
  });
});
