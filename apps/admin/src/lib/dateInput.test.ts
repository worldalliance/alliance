import { R } from "@alliance/common/result";
import {
  fromDateInput,
  fromDateInputRange,
  fromEndDateInput,
  toDateInput,
  toEndDateInput,
} from "./dateInput";

describe("date inputs", () => {
  it("round-trips a local calendar date", () => {
    expect(toDateInput(R.unwrap(fromDateInput("2026-06-10")))).toBe(
      "2026-06-10",
    );
  });

  it("round-trips an inclusive end date as the next day's start", () => {
    const end = R.unwrap(fromEndDateInput("2026-06-10"));
    expect(end).toBe(R.unwrap(fromDateInput("2026-06-11")));
    expect(toEndDateInput(end)).toBe("2026-06-10");
  });

  it("reads blank as absent", () => {
    expect(fromDateInput("")).toEqual(R.success(null));
    expect(toDateInput(null)).toBe("");
    expect(fromEndDateInput("")).toEqual(R.success(null));
    expect(toEndDateInput(undefined)).toBe("");
  });

  it("round-trips a year still being typed", () => {
    expect(toDateInput(R.unwrap(fromDateInput("0002-09-01")))).toBe(
      "0002-09-01",
    );
    expect(toEndDateInput(R.unwrap(fromEndDateInput("0002-09-01")))).toBe(
      "0002-09-01",
    );
  });

  it("fails on a year too long for an ISO string", () => {
    expect(fromDateInput("20260-01-05").ok).toBe(false);
    expect(fromEndDateInput("202600-01-05").ok).toBe(false);
    const lastDay = fromEndDateInput("9999-12-31");
    expect(lastDay.ok ? lastDay.value : "refused").not.toMatch(/^[+-]/);
  });
});

describe("fromDateInputRange", () => {
  it("spans the start of the first local day to the end of the last", () => {
    expect(
      fromDateInputRange({ start: "2026-01-10", end: "2026-01-20" }),
    ).toEqual(
      R.success({
        start: new Date(2026, 0, 10),
        end: new Date(2026, 0, 20, 23, 59, 59, 999),
      }),
    );
  });

  it("reads either side blank as no range, and fails on an invalid side", () => {
    expect(fromDateInputRange({ start: "", end: "2026-01-20" })).toEqual(
      R.success(null),
    );
    expect(
      fromDateInputRange({ start: "2026-01-10", end: "20260-01-20" }).ok,
    ).toBe(false);
  });
});
