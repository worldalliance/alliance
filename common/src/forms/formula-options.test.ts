import { describe, expect, it } from "bun:test";
import { R } from "../result";
import {
  formSchema,
  type AnyField,
  type FormSchema,
  type ListField,
  type MultiSelectField,
  type SelectField,
} from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";
import { formulaSourceFormIds, readOptionsResult } from "./formula-options";
import type { VariableInput } from "./variable-inputs";

const SOURCE = 7;
const OTHER_SOURCE = 8;

const choice = (value: string, label = value.toUpperCase()) => ({
  label,
  value,
});

const multiselect = (
  id: string,
  options: { label: string; value: string }[] = [],
): MultiSelectField => ({
  id,
  type: "input",
  kind: "multiselect",
  label: id,
  options,
});

const formulaSelect = (
  id: string,
  inputs: Record<string, VariableInput>,
  formula: string,
): SelectField => ({
  id,
  type: "input",
  kind: "select",
  label: id,
  options: [],
  optionsFormula: { inputs, formula },
});

const formulaMultiselect = (
  id: string,
  inputs: Record<string, VariableInput>,
  formula: string,
): MultiSelectField => ({
  ...multiselect(id),
  optionsFormula: { inputs, formula },
});

const schemaOf = (fields: AnyField[]): FormSchema => ({
  pages: [{ id: "p1", fields }],
  outputViews: [],
});

const sourceColors = {
  kind: "sourceField",
  sourceFormId: SOURCE,
  fieldId: "colors",
} as const;

const colorsField = multiselect("colors", [
  choice("red", "Red"),
  choice("blue", "Blue"),
  choice("green", "Green"),
]);

const LATEST = "input1.at(-1) ?? []";
const ALL = "input1.flatMap(answer => answer ?? [])";

describe("readOptionsResult", () => {
  it("keeps the first label and position of a repeated value", () => {
    expect(
      readOptionsResult([
        choice("a", "First"),
        choice("b"),
        choice("a", "Second"),
      ]),
    ).toEqual(R.success([choice("a", "First"), choice("b")]));
  });

  it("keeps values that differ only in case, and equal labels with different values", () => {
    const options = [
      choice("a", "Same"),
      choice("A", "Same"),
      choice("b", "Same"),
    ];
    expect(readOptionsResult(options)).toEqual(R.success(options));
  });

  it("drops keys other than label and value", () => {
    expect(readOptionsResult([{ label: "A", value: "a", extra: 1 }])).toEqual(
      R.success([choice("a", "A")]),
    );
  });

  it("accepts an empty list", () => {
    expect(readOptionsResult([])).toEqual(R.success([]));
  });

  it.each([
    ["nothing", undefined],
    ["text", "a"],
    ["a list of lists", [[choice("a")]]],
    ["a record without a value", [{ label: "A" }]],
    ["a numeric value", [{ label: "A", value: 1 }]],
    ["an empty value", [{ label: "A", value: "" }]],
  ])("rejects %s", (_name, value) => {
    expect(R.isFailure(readOptionsResult(value))).toBe(true);
  });
});

describe("options formula schema", () => {
  it("lists the forms options formulas read beside the variables'", () => {
    const schema: FormSchema = {
      ...schemaOf([formulaSelect("pick", { input1: sourceColors }, LATEST)]),
      variables: [
        {
          name: "v",
          inputs: { input1: { ...sourceColors, sourceFormId: OTHER_SOURCE } },
          formula: "1",
        },
      ],
    };
    expect(formulaSourceFormIds(schema)).toEqual([SOURCE, OTHER_SOURCE]);
  });

  it.each([
    ["fixed options", { options: [choice("a")] }],
    ["categories", { categories: [{ id: "c", name: "C" }] }],
    ["a default", { defaultValue: "a" }],
  ])("rejects a formula field with %s", (_name, extra) => {
    const schema = schemaOf([{ ...formulaSelect("pick", {}, "[]"), ...extra }]);
    expect(formSchema.safeParse(schema).success).toBe(false);
  });

  it.each([
    ["fixed options", { options: [choice("a")] }],
    ["categories", { categories: [{ id: "c", name: "C" }] }],
    ["a default", { defaultValue: ["a"] }],
  ])("rejects a formula multiselect with %s", (_name, extra) => {
    const schema = schemaOf([
      { ...formulaMultiselect("pick", {}, "[]"), ...extra },
    ]);
    expect(formSchema.safeParse(schema).success).toBe(false);
  });
});

describe("validateFormSchema with options formulas", () => {
  const messages = (fields: AnyField[]) =>
    validateFormSchema(schemaOf(fields), {
      formId: 1,
      sourceForms: new Map([[SOURCE, [colorsField]]]),
    }).map(({ blockId, message }) => `${blockId}: ${message}`);

  it("accepts latest and all-submission formulas", () => {
    expect(
      messages([
        formulaSelect("latest", { input1: sourceColors }, LATEST),
        formulaMultiselect("all", { input1: sourceColors }, ALL),
      ]),
    ).toEqual([]);
  });

  it("rejects a formula giving a list of lists", () => {
    expect(
      messages([formulaSelect("pick", { input1: sourceColors }, "input1")]),
    ).toEqual([
      expect.stringContaining(
        "pick: Options formula: An options formula has to give a list of { label, value } records",
      ),
    ]);
  });

  it("rejects a label that adds a list to text", () => {
    expect(
      messages([
        formulaSelect(
          "pick",
          { input1: sourceColors },
          "[{ label: 'All of ' + (input1 ?? []), value: 'all' }]",
        ),
      ]),
    ).toEqual([
      expect.stringContaining(
        "Only text, a number or a yes/no can be added to text",
      ),
    ]);
  });

  it("rejects a formula that gives nothing before anything is answered", () => {
    expect(
      messages([
        formulaSelect("pick", { input1: sourceColors }, "input1.at(-1)"),
      ]),
    ).toEqual([expect.stringContaining("Add ?? []")]);
  });

  it("rejects a missing question and a missing form", () => {
    expect(
      messages([
        formulaSelect(
          "pick",
          {
            input1: { ...sourceColors, fieldId: "gone" },
            input2: { ...sourceColors, sourceFormId: OTHER_SOURCE },
          },
          "[]",
        ),
      ]),
    ).toEqual([
      expect.stringContaining("no longer has"),
      expect.stringContaining("doesn't exist"),
    ]);
  });

  it("rejects an input counting members' answers", () => {
    expect(
      messages([
        formulaSelect(
          "pick",
          {
            input1: {
              kind: "aggregate",
              sourceFormId: SOURCE,
              fieldId: "colors",
            },
          },
          "[]",
        ),
      ]),
    ).toEqual([
      `pick: Options formula: Input "input1" counts members' answers, which an options formula can't read`,
    ]);
  });

  it("rejects formulas reading each other", () => {
    expect(
      messages([
        formulaSelect("a", { input1: { kind: "field", fieldId: "b" } }, "[]"),
        formulaSelect("b", { input1: { kind: "field", fieldId: "a" } }, "[]"),
      ]),
    ).toEqual([expect.stringContaining("a → b → a")]);
  });

  const listOf = (cell: SelectField): ListField => ({
    id: "rows",
    type: "input",
    kind: "list",
    label: "Rows",
    fields: [cell],
  });
  const readRows = {
    kind: "list" as const,
    fieldId: "rows",
    properties: { cell: "cell" },
  };

  it("rejects a field and a list sub-field reading each other through the list", () => {
    expect(
      messages([
        formulaSelect("pick", { input1: readRows }, "[]"),
        listOf(
          formulaSelect(
            "cell",
            { input1: { kind: "field", fieldId: "pick" } },
            "[]",
          ),
        ),
      ]),
    ).toContainEqual(expect.stringContaining("pick → cell → pick"));
  });

  it("rejects a list sub-field reading its own list", () => {
    expect(
      messages([listOf(formulaSelect("cell", { input1: readRows }, "[]"))]),
    ).toContainEqual(expect.stringContaining("cell → cell"));
  });

  it("checks a list sub-field's formula", () => {
    const list: ListField = {
      id: "rows",
      type: "input",
      kind: "list",
      label: "Rows",
      fields: [formulaSelect("cell", { input1: sourceColors }, '"x"')],
    };
    expect(messages([list])).toEqual([
      expect.stringContaining("cell: Options formula"),
    ]);
  });
});
