import type { RangeField } from "./form-schema";
import { getRangeValues } from "./range";

describe("getRangeValues", () => {
  const rangeField = (optionCount?: number): RangeField => ({
    id: "scale",
    type: "input",
    kind: "range",
    label: "Scale",
    optionCount,
  });

  it("defaults to 1 through 10", () => {
    expect(getRangeValues(rangeField())).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("floors the count and clamps it to 2 through 50", () => {
    expect(getRangeValues(rangeField(3.7))).toEqual([1, 2, 3]);
    expect(getRangeValues(rangeField(1))).toEqual([1, 2]);
    expect(getRangeValues(rangeField(80))).toHaveLength(50);
    expect(getRangeValues(rangeField(Number.NaN))).toHaveLength(10);
  });
});
