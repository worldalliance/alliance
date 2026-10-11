import { describe, expect, it } from "bun:test";
import { dedupeTickLabels } from "./chartAxes";

describe("dedupeTickLabels", () => {
  it("keeps the first tick of each formatted label", () => {
    expect(
      dedupeTickLabels([0, 0.4, 1, 1.4, 2], (v) => String(Math.round(v))),
    ).toEqual([0, 1, 2]);
  });

  it("keeps every tick whose label is empty", () => {
    expect(dedupeTickLabels([0, 1, 2], (v) => (v === 1 ? "x" : ""))).toEqual([
      0, 1, 2,
    ]);
  });

  it("falls back to the raw value without a format", () => {
    expect(dedupeTickLabels([1, 2, 2])).toEqual([1, 2]);
  });
});
