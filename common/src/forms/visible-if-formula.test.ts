import { evaluateVisibilityFormulaWithUnknowns } from "./visible-if-formula";

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
