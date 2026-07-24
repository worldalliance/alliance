import type { RankingField } from "./form-schema";
import {
  getRankingOptionLabel,
  getRankingSlotCount,
  isValidRankingSelection,
  sanitizeRankingValue,
} from "./ranking";

const makeField = (overrides: Partial<RankingField> = {}): RankingField => ({
  id: "rank",
  type: "input",
  kind: "ranking",
  label: "Rank these",
  options: [
    { label: "**A**", value: "a" },
    { label: "B", value: "b" },
    { label: "C", value: "c" },
    { label: "D", value: "d" },
  ],
  ...overrides,
});

describe("getRankingSlotCount", () => {
  it("defaults to the number of options", () => {
    expect(getRankingSlotCount(makeField())).toBe(4);
  });

  it("uses numToRank when set", () => {
    expect(getRankingSlotCount(makeField({ numToRank: 2 }))).toBe(2);
  });

  it("caps numToRank at the number of options", () => {
    expect(getRankingSlotCount(makeField({ numToRank: 10 }))).toBe(4);
  });

  it("clamps numToRank to at least 1 and floors decimals", () => {
    expect(getRankingSlotCount(makeField({ numToRank: 0 }))).toBe(1);
    expect(getRankingSlotCount(makeField({ numToRank: 2.9 }))).toBe(2);
  });
});

describe("getRankingOptionLabel", () => {
  it("resolves the label for a value and falls back to the raw value", () => {
    expect(getRankingOptionLabel(makeField(), "a")).toBe("**A**");
    expect(getRankingOptionLabel(makeField(), "gone")).toBe("gone");
  });
});

describe("isValidRankingSelection", () => {
  it("accepts an empty and a partial ranking", () => {
    expect(isValidRankingSelection(makeField(), [])).toBe(true);
    expect(isValidRankingSelection(makeField(), ["b", "a"])).toBe(true);
  });

  it("rejects non-arrays, unknown values, and duplicates", () => {
    expect(isValidRankingSelection(makeField(), "b")).toBe(false);
    expect(isValidRankingSelection(makeField(), ["nope"])).toBe(false);
    expect(isValidRankingSelection(makeField(), ["b", "b"])).toBe(false);
  });

  it("rejects rankings longer than the slot count", () => {
    expect(
      isValidRankingSelection(makeField({ numToRank: 2 }), ["a", "b", "c"]),
    ).toBe(false);
  });
});

describe("sanitizeRankingValue", () => {
  it("drops stale entries, duplicates, and overflow while keeping order", () => {
    expect(
      sanitizeRankingValue(makeField({ numToRank: 2 }), [
        "gone",
        "c",
        "c",
        "b",
        "a",
      ]),
    ).toEqual(["c", "b"]);
  });

  it("returns an empty ranking for non-array values", () => {
    expect(sanitizeRankingValue(makeField(), "c")).toEqual([]);
    expect(sanitizeRankingValue(makeField(), undefined)).toEqual([]);
  });
});
