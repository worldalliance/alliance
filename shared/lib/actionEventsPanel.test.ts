import { sortByDateDescending } from "./actionEventsPanel";

describe("sortByDateDescending", () => {
  it("orders a copy newest first, leaving the input as it was", () => {
    const older = { date: "2026-01-01T00:00:00.000Z" };
    const newer = { date: "2026-02-01T00:00:00.000Z" };
    const oldestFirst = [older, newer];
    expect(sortByDateDescending(oldestFirst)).toEqual([newer, older]);
    expect(oldestFirst).toEqual([older, newer]);
  });
});
