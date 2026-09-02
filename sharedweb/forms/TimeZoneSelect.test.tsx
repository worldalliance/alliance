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

it("shows the words a member's search matched on", () => {
  render(<TimeZoneSelect />);

  searchFor("sri lanka");

  expect(screen.getByText("India Standard Time — Kolkata")).toBeDefined();
  expect(screen.getByText("India, Sri Lanka Time")).toBeDefined();
});

it("keeps them on the trigger once the member picks the row", () => {
  render(<TimeZoneSelect />);

  searchFor("sri lanka");
  fireEvent.click(screen.getByText("India Standard Time — Kolkata"));

  expect(screen.getByText("India, Sri Lanka Time")).toBeDefined();
});

it("leaves a row alone where the curated label repeats its name", () => {
  render(<TimeZoneSelect />);

  searchFor("dubai");

  expect(screen.getByText("Gulf Standard Time — Dubai")).toBeDefined();
  expect(screen.queryByText("Dubai Time")).toBeNull();
});
