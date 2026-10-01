import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import {
  customValidatorIds,
  mapCustomValidatorIds,
} from "./customValidatorIds";

const onValidator = (validatorId: number): VisibleIfFormula => ({
  conditions: {
    condition1: { kind: "validator", validatorId },
    condition2: { kind: "hasValue", when: "x", hasValue: true },
  },
  formula: { op: "AND", left: "condition1", right: "condition2" },
});

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      visibleIfFormula: onValidator(-1),
      fields: [
        {
          type: "input",
          kind: "text",
          id: "a",
          label: "A",
          customValidatorId: -2,
          requiredIfFormula: onValidator(-3),
        },
        {
          type: "group",
          kind: "group",
          id: "g",
          visibleIfFormula: onValidator(-4),
          requiredIfFormula: onValidator(-5),
          fields: [
            {
              type: "display",
              kind: "header",
              id: "h",
              text: "H",
              visibleIfFormula: onValidator(-6),
            },
            {
              type: "input",
              kind: "text",
              id: "b",
              label: "B",
              customValidatorId: -10,
              requiredIfFormula: onValidator(-11),
            },
          ],
        },
        {
          type: "input",
          kind: "list",
          id: "l",
          label: null,
          fields: [
            {
              type: "input",
              kind: "text",
              id: "sub",
              label: "Sub",
              customValidatorId: -7,
              visibleIfFormula: onValidator(-8),
            },
          ],
        },
        { type: "input", kind: "text", id: "plain", label: "Plain" },
      ],
    },
  ],
  outputViews: [
    {
      type: "default",
      id: "view",
      blocks: [{ id: "o", fieldId: "a", visibleIfFormula: onValidator(-9) }],
    },
  ],
};

describe("customValidatorIds", () => {
  it("finds validators on fields, list sub-fields, and every formula", () => {
    expect([...customValidatorIds(schema)].sort((x, y) => y - x)).toEqual([
      -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11,
    ]);
  });
});

describe("mapCustomValidatorIds", () => {
  it("rewrites every reference it finds and leaves the rest as it was", () => {
    const mapped = mapCustomValidatorIds(schema, (id) => -id);

    expect([...customValidatorIds(mapped)].sort((x, y) => x - y)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(JSON.stringify(mapCustomValidatorIds(mapped, (id) => -id))).toEqual(
      JSON.stringify(schema),
    );
    expect(mapped.pages[0].fields[3]).toEqual(schema.pages[0].fields[3]);
    expect("visibleIfFormula" in mapped.pages[0].fields[3]).toBe(false);
  });
});
