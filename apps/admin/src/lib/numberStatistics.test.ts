import { buildNumberStats, formatNumber } from "./numberStatistics";

it("formats to at most two decimals without trailing zeros", () => {
  expect(formatNumber(3)).toBe("3");
  expect(formatNumber(2.5)).toBe("2.5");
  expect(formatNumber(1.006)).toBe("1.01");
});

it("reports every response as unanswered when none has a number", () => {
  expect(buildNumberStats([], 2)).toEqual({
    rows: [{ key: "no-response", label: "No response", count: 2 }],
    answeredCount: 0,
  });
  expect(buildNumberStats([], 0)).toEqual({ rows: [], answeredCount: 0 });
});

it("shows one row when every answer is the same", () => {
  expect(buildNumberStats([4, 4], 3)).toEqual({
    rows: [
      { key: "no-response", label: "No response", count: 1 },
      { key: "single-value", label: "4", count: 2 },
    ],
    answeredCount: 2,
    summary: { min: 4, max: 4, avg: 4, median: 4, total: 8 },
  });
});

it("counts each integer answer and summarizes them", () => {
  expect(buildNumberStats([3, 1, 3, 2], 4)).toEqual({
    rows: [
      { key: "int-1", label: "1", count: 1 },
      { key: "int-2", label: "2", count: 1 },
      { key: "int-3", label: "3", count: 2 },
    ],
    answeredCount: 4,
    summary: { min: 1, max: 3, avg: 2.25, median: 2.5, total: 9 },
  });
});

it("buckets decimal answers into equal-width bins", () => {
  const stats = buildNumberStats([0, 0.5, 3], 4);
  expect(stats.rows).toEqual([
    { key: "no-response", label: "No response", count: 1 },
    { key: "bin-0", label: "0 - 1", count: 2 },
    { key: "bin-1", label: "1 - 2", count: 0 },
    { key: "bin-2", label: "2 - 3", count: 1 },
  ]);
  expect(stats.summary?.median).toBe(0.5);
});
