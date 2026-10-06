import type {
  Condition,
  VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import { parseVisibilityFormula } from "@alliance/shared/forms/visibilityFormula";
import {
  buildFormula,
  checkExpression,
  Combinator,
  nextConditionName,
  simpleFormulaOf,
  sortedConditionNames,
} from "./conditionFormula";

const answered: Condition = { kind: "hasValue", when: "q", hasValue: true };
const isRed: Condition = { kind: "equals", when: "color", equals: "red" };
const device: Condition = { kind: "deviceType", deviceType: ["mobile"] };
const validator: Condition = { kind: "validator", validatorId: 1 };

const visibility = (
  text: string,
  conditions: Record<string, Condition>,
): VisibleIfFormula => {
  const formula = parseVisibilityFormula(text);
  if (!formula.ok) throw new Error(formula.error);
  return { conditions, formula: formula.value };
};

describe("simpleFormulaOf", () => {
  it.each([
    ["c1", { c1: isRed }, Combinator.All, [{ name: "c1", negated: false }]],
    ["NOT c1", { c1: isRed }, Combinator.All, [{ name: "c1", negated: true }]],
    [
      "a AND NOT b AND c",
      { a: isRed, b: answered, c: device },
      Combinator.All,
      [
        { name: "a", negated: false },
        { name: "b", negated: true },
        { name: "c", negated: false },
      ],
    ],
    [
      "(a OR b) OR NOT c",
      { a: isRed, b: device, c: isRed },
      Combinator.Any,
      [
        { name: "a", negated: false },
        { name: "b", negated: false },
        { name: "c", negated: true },
      ],
    ],
  ])("reads %p as a rule list", (text, conditions, combinator, rules) => {
    expect(simpleFormulaOf(visibility(text, conditions))).toEqual({
      combinator,
      rules,
    });
  });

  it.each([
    ["mixed operators", "a AND (b OR c)", { a: isRed, b: isRed, c: isRed }],
    ["a negated group", "NOT (a AND b)", { a: isRed, b: isRed }],
    ["a repeated name", "a AND a", { a: isRed }],
    ["an unreferenced condition", "a", { a: isRed, b: isRed }],
    ["a missing condition", "a AND b", { a: isRed }],
    ["a NOT the rule can't show", "NOT a", { a: device }],
    ["a NOT over a name only Object.prototype has", "NOT constructor", {}],
    ["a NOT over a validator", "NOT a", { a: validator }],
  ])("leaves %s to the expression editor", (_, text, conditions) => {
    expect(simpleFormulaOf(visibility(text, conditions))).toBeNull();
  });
});

describe("buildFormula", () => {
  it("rebuilds every simple formula it reads", () => {
    for (const text of ["a", "NOT a", "a AND NOT b AND c", "a OR b OR NOT c"]) {
      const names = text.match(/\b[abc]\b/g) ?? [];
      const v = visibility(
        text,
        Object.fromEntries(names.map((name) => [name, isRed])),
      );
      const simple = simpleFormulaOf(v);
      expect(simple && buildFormula(simple)).toEqual(v.formula);
    }
  });

  it("leaves an empty rule list unconditional", () => {
    expect(buildFormula({ combinator: Combinator.Any, rules: [] })).toBeNull();
  });
});

describe("nextConditionName", () => {
  it("numbers past every name in the conditions and formula", () => {
    expect(nextConditionName(undefined)).toBe("condition1");
    expect(
      nextConditionName(
        visibility("condition2 AND condition7", {
          condition2: isRed,
          c9: isRed,
        }),
      ),
    ).toBe("condition8");
    expect(
      nextConditionName(visibility("c1 OR Condition4", { c1: isRed })),
    ).toBe("condition5");
  });
});

it("sorts names numerically", () => {
  expect(
    sortedConditionNames({ condition10: isRed, condition2: isRed, c1: isRed }),
  ).toEqual(["c1", "condition2", "condition10"]);
});

describe("checkExpression", () => {
  it("names each rule the text references without a condition once", () => {
    expect(checkExpression("a AND (b OR NOT b)", { a: isRed })).toEqual({
      ok: false,
      error:
        "No rule is named b. Use the name of a rule below, or add a rule and use its name.",
    });
  });

  it("passes text whose names all have conditions", () => {
    expect(checkExpression("a OR NOT b", { a: isRed, b: isRed })).toEqual({
      ok: true,
      value: { op: "OR", left: "a", right: { op: "NOT", operand: "b" } },
    });
  });
});
