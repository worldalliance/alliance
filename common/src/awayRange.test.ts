import { isAwayRangeActiveAt } from "./awayRange";

describe("isAwayRangeActiveAt", () => {
  const range = {
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    endDate: new Date("2026-03-07T23:59:00.000Z"),
  };
  const at = (date: Date, offsetMs: number) =>
    isAwayRangeActiveAt(range, new Date(date.getTime() + offsetMs));

  it("counts the start instant but not the end instant", () => {
    expect(at(range.startDate, -1)).toBe(false);
    expect(at(range.startDate, 0)).toBe(true);
    expect(at(range.endDate, -1)).toBe(true);
    expect(at(range.endDate, 0)).toBe(false);
  });
});
