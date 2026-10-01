import type { RangeField } from "./form-schema";
import {
  getRangeValues,
  isEmptyRangeAnswer,
  isValidRangeSelection,
} from "./range";

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

describe("isValidRangeSelection", () => {
  const field: RangeField = {
    id: "scale",
    type: "input",
    kind: "range",
    label: "Scale",
    optionCount: 5,
  };

  it.each([1, 3, 5])("accepts %p", (value) => {
    expect(isValidRangeSelection(field, value)).toBe(true);
  });

  it.each([0, 6, 2.5, Number.NaN, "3"])("rejects %p", (value) => {
    expect(isValidRangeSelection(field, value)).toBe(false);
  });
});

describe("isEmptyRangeAnswer", () => {
  it("counts undefined, null, and the empty string as no answer", () => {
    expect([undefined, null, ""].map(isEmptyRangeAnswer)).toEqual([
      true,
      true,
      true,
    ]);
    expect([0, 3, " ", Number.NaN].map(isEmptyRangeAnswer)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
