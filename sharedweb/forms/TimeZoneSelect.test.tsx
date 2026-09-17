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

function searchFor(query: string): void {
  fireEvent.click(screen.getByRole("button"));
  act(() => {
    fireEvent.change(screen.getByPlaceholderText("Search time zones…"), {
      target: { value: query },
    });
  });
}

it("shows the country a member's search matched on", () => {
  render(<TimeZoneSelect />);

  searchFor("sri lanka");

  expect(screen.getByText("India Standard Time — Colombo")).toBeDefined();
  expect(screen.getByText("Sri Lanka")).toBeDefined();
});

it("keeps it on the trigger once the member picks the row", () => {
  render(<TimeZoneSelect />);

  searchFor("sri lanka");
  fireEvent.click(screen.getByText("India Standard Time — Colombo"));

  expect(screen.getByText("Sri Lanka")).toBeDefined();
});

function pressEnter(): void {
  fireEvent.keyDown(screen.getByPlaceholderText("Search time zones…"), {
    key: "Enter",
  });
}

it("saves the row a search names alone on Enter", () => {
  render(<TimeZoneSelect />);

  searchFor("india");
  pressEnter();

  expect(screen.getByText("India Standard Time — Kolkata")).toBeDefined();
});

it("opens on the first row when a member arrows down from the trigger", () => {
  render(<TimeZoneSelect />);

  fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
  pressEnter();

  expect(screen.queryByPlaceholderText("Search time zones…")).toBeNull();
});

it("saves nothing on Enter when a search names several rows first", () => {
  render(<TimeZoneSelect />);

  searchFor("usa");
  pressEnter();

  expect(screen.getByPlaceholderText("Search time zones…")).toBeDefined();
  expect(screen.getAllByText("Pacific Time — Los Angeles")).toHaveLength(2);
});
