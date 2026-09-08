import { HOURS, spentIndex } from "./hoursGrid";

describe("spentIndex", () => {
  it("lands on the middle cell of the wide desktop grid", () => {
    const i = spentIndex(24);
    expect(i).toBe(84);
    expect(i % 24).toBe(12);
    expect(Math.floor(i / 24)).toBe(3);
  });

  it("lands on the middle cell of the narrow phone grid", () => {
    const i = spentIndex(12);
    expect(i).toBe(90);
    expect(i % 12).toBe(6);
    expect(Math.floor(i / 12)).toBe(7);
  });

  // The bug this replaced put one fixed cell in both grids, which centred the
  // 12-column one and left the 24-column one a quarter of the way across.
  it("centres every arrangement rather than one of them", () => {
    for (const columns of [12, 24]) {
      const rows = HOURS / columns;
      const i = spentIndex(columns);
      expect(Math.abs((i % columns) - columns / 2)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(Math.floor(i / columns) - rows / 2)).toBeLessThanOrEqual(
        0.5,
      );
    }
  });

  it("stays inside the grid", () => {
    for (const columns of [12, 24]) {
      expect(spentIndex(columns)).toBeLessThan(HOURS);
      expect(spentIndex(columns)).toBeGreaterThanOrEqual(0);
    }
  });
});
