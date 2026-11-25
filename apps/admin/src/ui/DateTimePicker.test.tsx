import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import DateTimePicker, {
  formatZonedDateTime,
  parseZonedDateTime,
  timeZoneLabel,
} from "./DateTimePicker";
import { Field } from "./templates/Form";

afterEach(cleanup);

const PACIFIC = "America/Los_Angeles";

describe("DateTimePicker with a time zone", () => {
  it("shows the instant on the zone's wall clock", () => {
    render(
      <DateTimePicker
        id="starts"
        label="Starts"
        timeZone={PACIFIC}
        value="2026-11-25T03:30:00.000Z"
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>("Starts").value).toBe(
      "2026-11-24T19:30",
    );
  });

  it("reports the UTC instant of a wall-clock time picked in the zone", () => {
    const onChange = jest.fn();
    render(
      <DateTimePicker
        id="starts"
        label="Starts"
        timeZone={PACIFIC}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Starts"), {
      target: { value: "2026-07-04T09:30" },
    });
    expect(onChange).toHaveBeenCalledWith({
      utcValue: "2026-07-04T16:30:00.000Z",
      localValue: "2026-07-04T09:30",
      date: new Date("2026-07-04T16:30:00.000Z"),
    });
  });

  it("reports null when the field is cleared", () => {
    const onChange = jest.fn();
    render(
      <DateTimePicker
        id="starts"
        label="Starts"
        timeZone={PACIFIC}
        value="2026-11-25T03:30:00.000Z"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Starts"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith({
      utcValue: null,
      localValue: "",
      date: null,
    });
  });

  it("keeps seconds at second precision", () => {
    render(
      <DateTimePicker
        id="starts"
        label="Starts"
        timeZone={PACIFIC}
        precision="second"
        value="2026-11-25T03:30:15.000Z"
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>("Starts").value).toBe(
      "2026-11-24T19:30:15",
    );
  });

  it("takes its id, description and invalid state from a Field", () => {
    render(
      <Field label="Start date (Pacific time)" error="Pick a start date">
        {(control) => (
          <DateTimePicker {...control} timeZone={PACIFIC} onChange={() => {}} />
        )}
      </Field>,
    );
    const input = screen.getByLabelText("Start date (Pacific time)");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(
      screen.getByRole("alert").id,
    );
  });
});

describe("parseZonedDateTime", () => {
  it("moves a time skipped by the spring change an hour later", () => {
    expect(parseZonedDateTime("2026-03-08T02:30", PACIFIC)?.toISOString()).toBe(
      "2026-03-08T10:30:00.000Z",
    );
  });

  it("takes the first occurrence of a time the autumn change repeats", () => {
    expect(parseZonedDateTime("2026-11-01T01:30", PACIFIC)?.toISOString()).toBe(
      "2026-11-01T08:30:00.000Z",
    );
  });

  it("keeps the wall clock of an early year, as typing a year passes through one", () => {
    for (const timeZone of [PACIFIC, "Europe/Paris"]) {
      for (const wallClock of ["0020-07-04T09:30", "1850-07-04T09:30"]) {
        expect(
          formatZonedDateTime(parseZonedDateTime(wallClock, timeZone), {
            timeZone,
            precision: "minute",
          }),
        ).toBe(wallClock);
      }
    }
  });

  it("returns null for a value that isn't a date and time", () => {
    expect(parseZonedDateTime("", PACIFIC)).toBeNull();
    expect(parseZonedDateTime("2026-11-01", PACIFIC)).toBeNull();
  });
});

describe("timeZoneLabel", () => {
  it("names the zone in sentence case", () => {
    expect(timeZoneLabel(PACIFIC)).toBe("Pacific time");
    expect(timeZoneLabel("America/New_York")).toBe("Eastern time");
    expect(timeZoneLabel("Europe/Paris")).toBe("Central European time");
  });
});
