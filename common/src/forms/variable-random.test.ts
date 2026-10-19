import { describe, expect, it } from "bun:test";
import { R } from "../result";
import type { FormSchema, SelectField } from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";
import { evaluateOptionsFormula } from "./formula-options";
import { resolveOutputBlocks } from "./output-resolution";
import { evaluateVariable } from "./variable-evaluation";
import { variableInputSchema } from "./variable-inputs";
import { variableFieldScope } from "./variable-scope";
import { variableTypeEnv, type FormVariable } from "./variables";

const PICK = `["Senator Bob", "Congresswoman Suzie", "President Pam"][input1 % 3]`;

const pickVariable = (
  params: { name?: string; formula?: string } = {},
): FormVariable => ({
  name: params.name ?? "recipient",
  inputs: { input1: { kind: "random" } },
  formula: params.formula ?? PICK,
});

const evaluate = (variable: FormVariable, randomizationKey?: string) =>
  evaluateVariable(variable, {
    answers: {},
    fields: new Map(),
    randomizationKey,
  });

const memberKeys = Array.from({ length: 3000 }, (_, i) => `form:7:user:${i}`);

const schemaOf = (overrides: Partial<FormSchema>): FormSchema => ({
  pages: [{ id: "p1", fields: [] }],
  outputViews: [],
  ...overrides,
});

const pickOutput = schemaOf({
  outputViews: [
    {
      id: "view",
      type: "default",
      blocks: [
        { id: "text", type: "display", kind: "text", text: "#{recipient}" },
      ],
    },
  ],
  variables: [pickVariable()],
});

describe("variableInputSchema for random inputs", () => {
  it("round-trips a random input, and nothing more", () => {
    expect(variableInputSchema.parse({ kind: "random" })).toEqual({
      kind: "random",
    });
    expect(
      variableInputSchema.safeParse({ kind: "random", fieldId: "x" }).success,
    ).toBe(false);
  });
});

describe("evaluateVariable with a random input", () => {
  it("gives a member the same pick every time", () => {
    const first = evaluate(pickVariable(), memberKeys[0]);
    expect(first.ok).toBe(true);
    expect(evaluate(pickVariable(), memberKeys[0])).toEqual(first);
  });

  it("spreads members evenly across the picks", () => {
    const counts = new Map<string, number>();
    for (const key of memberKeys) {
      const pick = R.unwrap(evaluate(pickVariable(), key));
      counts.set(pick, (counts.get(pick) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([
      "Congresswoman Suzie",
      "President Pam",
      "Senator Bob",
    ]);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(900);
      expect(count).toBeLessThan(1100);
    }
  });

  it("picks independently for each variable, even by parity", () => {
    const parity = (name: string, key: string) =>
      R.unwrap(evaluate(pickVariable({ name, formula: "input1 % 2" }), key));
    const agreements = memberKeys.filter(
      (key) => parity("a", key) === parity("c", key),
    ).length;
    expect(agreements).toBeGreaterThan(1350);
    expect(agreements).toBeLessThan(1650);
  });

  it("picks independently for each input of a variable", () => {
    const both: FormVariable = {
      name: "both",
      inputs: { a: { kind: "random" }, b: { kind: "random" } },
      formula: "a === b",
    };
    expect(evaluate(both, memberKeys[0])).toEqual({ ok: true, value: "false" });
  });

  it("fails without a randomization key", () => {
    expect(evaluate(pickVariable())).toEqual({
      ok: false,
      error: "No randomization key to pick a random number with",
    });
  });
});

describe("variableTypeEnv for random inputs", () => {
  it("types the input as a number", () => {
    const scope = variableFieldScope(schemaOf({}), new Map());
    expect(variableTypeEnv(pickVariable(), scope).get("input1")).toBe("number");
  });
});

describe("validateFormSchema with random inputs", () => {
  const messages = (schema: FormSchema) =>
    validateFormSchema(schema).map(({ message }) => message);

  it("accepts a pick shown in an output view", () => {
    expect(messages(pickOutput)).toEqual([]);
  });

  it("rejects a formula that misuses the number", () => {
    expect(
      messages(
        schemaOf({ variables: [pickVariable({ formula: "input1.x" })] }),
      ),
    ).not.toEqual([]);
  });

  it("rejects a random input in an options formula", () => {
    const field: SelectField = {
      id: "pick",
      type: "input",
      kind: "select",
      label: "Pick",
      options: [],
      optionsFormula: { inputs: { input1: { kind: "random" } }, formula: "[]" },
    };
    expect(
      messages(schemaOf({ pages: [{ id: "p1", fields: [field] }] })),
    ).toEqual([
      'Options formula: Input "input1" picks a random number, which only a variable can use',
    ]);
  });
});

describe("evaluateOptionsFormula with a random input", () => {
  it("fails even with a randomization key", () => {
    const result = evaluateOptionsFormula(
      { inputs: { input1: { kind: "random" } }, formula: "[]" },
      { answers: {}, fields: new Map(), randomizationKey: memberKeys[0] },
    );
    expect(result).toEqual({
      ok: false,
      error: "A random input works only in a variable",
    });
  });
});

describe("resolveOutputBlocks with a random variable", () => {
  const recipient = (randomizationKey?: string) =>
    resolveOutputBlocks({
      schema: pickOutput,
      answers: {},
      randomizationKey,
    })?.variableValues.get("recipient");

  it("shows the pick the submitter's key gives the form", () => {
    expect(recipient(memberKeys[0])).toBe(
      R.unwrap(evaluate(pickVariable(), memberKeys[0])),
    );
  });

  it("leaves it unresolved without the submitter's key", () => {
    expect(recipient()).toBeUndefined();
  });
});
