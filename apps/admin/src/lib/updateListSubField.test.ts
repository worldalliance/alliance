import type {
  ListSubField,
  MultiSelectField,
  RadioField,
  TextField,
} from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { updateListSubField } from "./updateListSubField";

const equalsRed: VisibleIfFormula = {
  conditions: { c1: { kind: "equals", when: "color", equals: "red" } },
  formula: "c1",
};

const dependent = (
  id: string,
  visibleIfFormula: VisibleIfFormula | undefined = equalsRed,
): TextField => ({
  id,
  type: "input",
  kind: "text",
  label: id,
  visibleIfFormula,
});

const color: RadioField = {
  id: "color",
  type: "input",
  kind: "radio",
  label: "Color",
  options: [
    { label: "Red", value: "red" },
    { label: "Blue", value: "blue" },
  ],
};

const subFields: ListSubField[] = [
  dependent("above"),
  color,
  dependent("below"),
];

describe("updateListSubField", () => {
  it("carries an option value rename into siblings on both sides", () => {
    const next = updateListSubField(subFields, 1, {
      options: [
        { label: "Red", value: "crimson" },
        { label: "Blue", value: "blue" },
      ],
    });
    expect(next[0]?.visibleIfFormula?.conditions.c1).toMatchObject({
      equals: "crimson",
    });
    expect(next[2]?.visibleIfFormula?.conditions.c1).toMatchObject({
      equals: "crimson",
    });
  });

  it("leaves siblings alone when an option is only relabelled", () => {
    const next = updateListSubField(subFields, 1, {
      options: [
        { label: "Scarlet", value: "red" },
        { label: "Blue", value: "blue" },
      ],
    });
    expect(next[0]).toBe(subFields[0]);
    expect(next[2]).toBe(subFields[2]);
  });

  it("leaves siblings alone when an option is added", () => {
    const next = updateListSubField(subFields, 1, {
      options: [...color.options, { label: "Green", value: "green" }],
    });
    expect(next[0]).toBe(subFields[0]);
    expect(next[2]).toBe(subFields[2]);
  });

  it("rewrites includesOption conditions on a multiselect rename", () => {
    const toppings: MultiSelectField = {
      id: "toppings",
      type: "input",
      kind: "multiselect",
      label: "Toppings",
      options: [
        { label: "Ham", value: "ham" },
        { label: "Olive", value: "olive" },
      ],
    };
    const unrelated = dependent("unrelated", undefined);
    const next = updateListSubField(
      [
        toppings,
        dependent("hamNote", {
          conditions: {
            c1: {
              kind: "includesOption",
              when: "toppings",
              includesOption: "ham",
            },
          },
          formula: "c1",
        }),
        unrelated,
      ],
      0,
      {
        options: [
          { label: "Ham", value: "prosciutto" },
          { label: "Olive", value: "olive" },
        ],
      },
    );
    expect(next[1]?.visibleIfFormula?.conditions.c1).toMatchObject({
      includesOption: "prosciutto",
    });
    expect(next[2]).toBe(unrelated);
  });

  it("leaves another form's field alone when its id matches", () => {
    const crossForm = dependent("crossForm", {
      conditions: {
        c1: { kind: "equals", when: "color", equals: "red", sourceFormId: 7 },
        c2: {
          kind: "includesOption",
          when: "color",
          includesOption: "red",
          sourceFormId: 7,
        },
      },
      formula: "c1 || c2",
    });
    const next = updateListSubField([color, crossForm], 0, {
      options: [
        { label: "Red", value: "crimson" },
        { label: "Blue", value: "blue" },
      ],
    });
    expect(next[1]).toBe(crossForm);
  });
});
