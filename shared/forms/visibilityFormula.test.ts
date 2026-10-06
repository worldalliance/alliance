import {
  formulaConditionNames,
  parseVisibilityFormula,
  serializeVisibilityFormula,
} from "./visibilityFormula";

const parsed = (text: string) => {
  const result = parseVisibilityFormula(text);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe("parseVisibilityFormula", () => {
  it("accepts any identifier as a condition name", () => {
    expect(parsed("c1 AND (shown_2 OR NOT Visa)")).toEqual({
      op: "AND",
      left: "c1",
      right: {
        op: "OR",
        left: "shown_2",
        right: { op: "NOT", operand: "Visa" },
      },
    });
  });

  it("folds case only for generated conditionN names", () => {
    expect(parsed("Condition1 or C2")).toEqual({
      op: "OR",
      left: "condition1",
      right: "C2",
    });
  });

  it("binds NOT tighter than AND, and AND tighter than OR", () => {
    expect(parsed("not a and b or c")).toEqual({
      op: "OR",
      left: { op: "AND", left: { op: "NOT", operand: "a" }, right: "b" },
      right: "c",
    });
  });

  it.each([
    ["c1 AND", "Unexpected end of formula."],
    ["(c1 OR c2", "Missing closing parenthesis."],
    ["c1 c2", "Unexpected token after formula."],
    ["AND c1", "Expected a condition name or opening parenthesis."],
    ["c1 & c2", expect.stringContaining("Invalid formula syntax")],
  ])("rejects %p", (text, error) => {
    expect(parseVisibilityFormula(text)).toEqual({ ok: false, error });
  });
});

describe("serializeVisibilityFormula", () => {
  it("omits parentheses around a right-nested chain of one operator", () => {
    const text = "a AND b AND (c OR (NOT (d AND e)))";
    expect(serializeVisibilityFormula(parsed(text))).toBe(text);
  });

  it("keeps a left-nested chain's shape through a reparse", () => {
    const leftNested = parsed("(a AND b) AND c");
    expect(serializeVisibilityFormula(leftNested)).toBe("(a AND b) AND c");
    expect(parsed(serializeVisibilityFormula(leftNested))).toEqual(leftNested);
  });

  it("describes every condition in a chain through the leaf", () => {
    expect(
      serializeVisibilityFormula(parsed("a AND b AND c"), (name) =>
        name.toUpperCase(),
      ),
    ).toBe("A AND B AND C");
  });
});

describe("name round trips", () => {
  it.each([
    "c1",
    "shown_2",
    "país",
    "cafe\u0301",
    "हिंदी",
    "constructor",
    "__proto__",
    "condition3",
  ])("keeps %p", (name) => {
    expect(parsed(serializeVisibilityFormula(name))).toBe(name);
  });

  it.each([
    ["Condition1", { ok: true, value: "condition1" }],
    ["or", { ok: false, error: expect.any(String) }],
    ["shown-2", { ok: false, error: expect.any(String) }],
  ])("changes or rejects %p", (name, result) => {
    expect(parseVisibilityFormula(serializeVisibilityFormula(name))).toEqual(
      result,
    );
  });
});

it("lists every referenced name in order", () => {
  expect(formulaConditionNames(parsed("a AND (b OR NOT a)"))).toEqual([
    "a",
    "b",
    "a",
  ]);
});
