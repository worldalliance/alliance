import {
  conditionSchema,
  evaluateVisibilityFormulaWithUnknowns,
  SelectedCountComparison,
} from "./visible-if-formula";

describe("evaluateVisibilityFormulaWithUnknowns", () => {
  const results = { yes: true, no: false, unknown: undefined };

  it.each([
    [{ op: "AND", left: "no", right: "unknown" }, false],
    [{ op: "AND", left: "yes", right: "unknown" }, undefined],
    [{ op: "AND", left: "yes", right: "yes" }, true],
    [{ op: "OR", left: "yes", right: "unknown" }, true],
    [{ op: "OR", left: "no", right: "unknown" }, undefined],
    [{ op: "OR", left: "no", right: "no" }, false],
    [{ op: "NOT", operand: "unknown" }, undefined],
    [{ op: "NOT", operand: "no" }, true],
    ["missing", false],
  ] as const)("evaluates %j to %p", (node, expected) => {
    expect(evaluateVisibilityFormulaWithUnknowns(node, results)).toBe(expected);
  });
});

describe("selectedCount condition schema", () => {
  const condition = {
    kind: "selectedCount",
    when: "tags",
    comparison: SelectedCountComparison.AtLeast,
    count: 2,
  };

  it("accepts a whole, non-negative count", () => {
    expect(conditionSchema.safeParse(condition).success).toBe(true);
  });

  it.each([
    ["a negative count", { ...condition, count: -1 }],
    ["a fractional count", { ...condition, count: 1.5 }],
    ["an unknown comparison", { ...condition, comparison: "ne" }],
  ])("rejects %s", (_, invalid) => {
    expect(conditionSchema.safeParse(invalid).success).toBe(false);
  });
});
