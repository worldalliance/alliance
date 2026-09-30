import { R } from "@alliance/common/result";
import { fromDateInput, toDateInput } from "./dateInput";

describe("date inputs", () => {
  it("round-trips a local calendar date", () => {
    expect(toDateInput(R.unwrap(fromDateInput("2026-06-10")))).toBe(
      "2026-06-10",
    );
  });

  it("reads blank as absent", () => {
    expect(fromDateInput("")).toEqual(R.success(null));
    expect(toDateInput(null)).toBe("");
  });

  it("fails on a year too long for an ISO string", () => {
    expect(fromDateInput("20260-01-05").ok).toBe(false);
  });
});
