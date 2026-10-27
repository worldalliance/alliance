import type { FormSchema, TextField } from "./form-schema";
import {
  SKIP_IF_BLOCK_ID,
  ValidatedFormula,
  validateFormSchema,
} from "./form-schema-validate";
import { isFormSkipped } from "./skip-if";
import type { Condition, VisibleIfFormula } from "./visible-if-formula";

const formula = (conditions: Record<string, Condition>): VisibleIfFormula => ({
  conditions,
  formula: Object.keys(conditions)[0] ?? "",
});

const textField = (
  id: string,
  overrides: Partial<TextField> = {},
): TextField => ({ id, type: "input", kind: "text", label: id, ...overrides });

const schema = (overrides: Partial<FormSchema> = {}): FormSchema => ({
  pages: [
    { id: "p1", fields: [textField("fit")] },
    {
      id: "p2",
      fields: [textField("hidden")],
      visibleIfFormula: formula({
        c1: { kind: "equals", when: "fit", equals: "show" },
      }),
    },
  ],
  outputViews: [],
  ...overrides,
});

const extras = { deviceType: "desktop" as const };

describe("isFormSkipped", () => {
  const skippable = schema({
    skipIfFormula: formula({
      c1: { kind: "equals", when: "fit", equals: "no" },
    }),
  });

  it("is false without a skip formula", () => {
    expect(
      isFormSkipped({ schema: schema(), answers: { fit: "no" }, extras }),
    ).toBe(false);
  });

  it("holds when the formula matches", () => {
    expect(
      isFormSkipped({ schema: skippable, answers: { fit: "no" }, extras }),
    ).toBe(true);
  });

  it("is false when the formula doesn't match", () => {
    expect(
      isFormSkipped({ schema: skippable, answers: { fit: "yes" }, extras }),
    ).toBe(false);
  });

  it("ignores answers on hidden pages", () => {
    const readsHidden = schema({
      skipIfFormula: formula({
        c1: { kind: "equals", when: "hidden", equals: "skip" },
      }),
    });
    expect(
      isFormSkipped({
        schema: readsHidden,
        answers: { fit: "no", hidden: "skip" },
        extras,
      }),
    ).toBe(false);
  });
});

describe("validateFormSchema skipIfFormula", () => {
  it("accepts a reference to a field on the form", () => {
    expect(
      validateFormSchema(
        schema({
          skipIfFormula: formula({
            c1: { kind: "equals", when: "fit", equals: "no" },
          }),
        }),
      ),
    ).toEqual([]);
  });

  it("flags a reference to a field not on the form", () => {
    expect(
      validateFormSchema(
        schema({
          skipIfFormula: formula({
            c1: { kind: "equals", when: "missing", equals: "no" },
          }),
        }),
      ),
    ).toContainEqual({
      blockId: SKIP_IF_BLOCK_ID,
      formula: ValidatedFormula.SkipIf,
      message: `Skip condition references field "missing", which isn't on this form`,
    });
  });
});
