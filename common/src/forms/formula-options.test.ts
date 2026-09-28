import { describe, expect, it } from "bun:test";
import { R } from "../result";
import {
  formSchema,
  variableInputFieldsById,
  type AnyField,
  type FormSchema,
  type FormValue,
  type ListField,
  type MultiSelectField,
  type SelectField,
} from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";
import {
  formulaSourceFormIds,
  keepAvailableChoices,
  readFormulaChoices,
  readOptionsResult,
  resolveFormulaOptions,
  schemaWithResolvedOptions,
  schemaWithSavedChoices,
  selectedFormulaChoices,
  selectsFormulaChoice,
} from "./formula-options";
import type {
  VariableSourceHistory,
  VariableSourceResponse,
} from "./variable-evaluation";
import type { VariableInput } from "./variable-inputs";
import { syncSchemaListInputs } from "./variable-scope";

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

const history = (
  submissions: (FormValue | undefined)[],
): VariableSourceHistory => ({
  fields: variableInputFieldsById([colorsField]),
  responses: submissions.map(
    (colors, index): VariableSourceResponse => ({
      id: index + 1,
      answers: colors === undefined ? {} : { colors },
      fields: variableInputFieldsById([colorsField]),
    }),
  ),
});

const resolve = (params: {
  fields: AnyField[];
  answers?: Record<string, FormValue>;
  submissions?: (FormValue | undefined)[];
}) =>
  resolveFormulaOptions({
    schema: schemaOf(params.fields),
    answers: params.answers ?? {},
    sources: new Map([[SOURCE, history(params.submissions ?? [])]]),
  });

const optionsOf = (
  result: ReturnType<typeof resolveFormulaOptions>,
  fieldId: string,
) => R.unwrap(result).options.get(fieldId);

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

describe("resolveFormulaOptions from another form's submissions", () => {
  const field = (formula: string) =>
    formulaSelect("pick", { input1: sourceColors }, formula);

  it.each([
    ["no submissions", [], LATEST, []],
    ["one submission", [["red", "blue"]], LATEST, ["red", "blue"]],
    [
      "the latest of several",
      [["red"], ["green", "blue"]],
      LATEST,
      ["green", "blue"],
    ],
    ["an unanswered latest submission", [["red"], undefined], LATEST, []],
    ["no submissions, all of them", [], ALL, []],
    ["one submission, all of them", [["red", "blue"]], ALL, ["red", "blue"]],
    [
      "every submission, repeats merged",
      [["red", "blue"], undefined, ["green", "red"]],
      ALL,
      ["red", "blue", "green"],
    ],
  ])("offers %s", (_name, submissions, formula, values) => {
    const options = optionsOf(
      resolve({ fields: [field(formula)], submissions }),
      "pick",
    );
    expect(options?.map((option) => option.value)).toEqual(values);
  });

  it("uses the labels each submission's form version gave", () => {
    const options = optionsOf(
      resolve({ fields: [field(LATEST)], submissions: [["red"]] }),
      "pick",
    );
    expect(options).toEqual([choice("red", "Red")]);
  });

  it("unions the latest selections of two forms, with a fixed choice", () => {
    const schema = schemaOf([
      formulaMultiselect(
        "pick",
        {
          input1: sourceColors,
          input2: { ...sourceColors, sourceFormId: OTHER_SOURCE },
        },
        '(input1.at(-1) ?? []).concat(input2.at(-1) ?? [], [{ label: "Other", value: "other" }])',
      ),
    ]);
    const result = resolveFormulaOptions({
      schema,
      answers: {},
      sources: new Map([
        [SOURCE, history([["red"]])],
        [OTHER_SOURCE, history([["red", "green"]])],
      ]),
    });
    expect(optionsOf(result, "pick")).toEqual([
      choice("red", "Red"),
      choice("green", "Green"),
      choice("other", "Other"),
    ]);
  });

  it("keeps values apart when a formula renames them", () => {
    const schema = schemaOf([
      formulaSelect(
        "pick",
        {
          input1: sourceColors,
          input2: { ...sourceColors, sourceFormId: OTHER_SOURCE },
        },
        '(input1.at(-1) ?? []).map(c => ({ label: c.label, value: "a:" + c.value })).concat((input2.at(-1) ?? []).map(c => ({ label: c.label, value: "b:" + c.value })))',
      ),
    ]);
    const result = resolveFormulaOptions({
      schema,
      answers: {},
      sources: new Map([
        [SOURCE, history([["red"]])],
        [OTHER_SOURCE, history([["red"]])],
      ]),
    });
    expect(optionsOf(result, "pick")?.map((option) => option.value)).toEqual([
      "a:red",
      "b:red",
    ]);
  });

  it("fails when the history isn't loaded", () => {
    const result = resolveFormulaOptions({
      schema: schemaOf([field(LATEST)]),
      answers: {},
    });
    expect(R.isFailure(result) && result.error).toContain("not loaded");
  });

  it("fails on a formula that can give nothing", () => {
    const result = resolve({ fields: [field("input1.at(-1)")] });
    expect(R.isFailure(result) && result.error).toContain('"pick"');
  });
});

describe("resolveFormulaOptions from this form's answers", () => {
  const source = multiselect("source", [choice("a", "A"), choice("b", "B")]);

  it("reads a list's rows", () => {
    const people: ListField = {
      id: "people",
      type: "input",
      kind: "list",
      label: "People",
      fields: [{ id: "name", type: "input", kind: "text", label: "Name" }],
    };
    const result = resolve({
      fields: [
        people,
        formulaSelect(
          "pick",
          {
            input1: {
              kind: "list",
              fieldId: "people",
              properties: { name: "name" },
            },
          },
          "input1.filter(p => p.name).map(p => ({ label: p.name, value: p.name }))",
        ),
      ],
      answers: { people: [{ name: "Ada" }, {}, { name: "Lin" }] },
    });
    expect(optionsOf(result, "pick")).toEqual([
      choice("Ada", "Ada"),
      choice("Lin", "Lin"),
    ]);
  });

  it("drops an unavailable select answer and only the unavailable multiselect values", () => {
    const result = resolve({
      fields: [
        source,
        formulaSelect(
          "one",
          { input1: { kind: "field", fieldId: "source" } },
          "input1 ?? []",
        ),
        formulaMultiselect(
          "many",
          { input1: { kind: "field", fieldId: "source" } },
          "input1 ?? []",
        ),
      ],
      answers: { source: ["a"], one: "b", many: ["b", "a"] },
    });
    expect(R.unwrap(result).answers).toEqual({ source: ["a"], many: ["a"] });
  });

  it("resolves a formula after the one whose answer it reads, with that one's labels", () => {
    const result = resolve({
      fields: [
        formulaMultiselect(
          "second",
          { input1: { kind: "field", fieldId: "first" } },
          "input1 ?? []",
        ),
        formulaMultiselect("first", { input1: sourceColors }, ALL),
      ],
      submissions: [["red", "blue"]],
      answers: { first: ["blue", "green"] },
    });
    expect(optionsOf(result, "second")).toEqual([choice("blue", "Blue")]);
    expect(R.unwrap(result).answers).toEqual({ first: ["blue"] });
  });

  it("fails on a formula reading its own answer", () => {
    const result = resolve({
      fields: [
        formulaSelect(
          "self",
          { input1: { kind: "field", fieldId: "self" } },
          "[]",
        ),
      ],
    });
    expect(R.isFailure(result) && result.error).toContain("self → self");
  });

  it("fails on formulas reading each other", () => {
    const result = resolve({
      fields: [
        formulaSelect("a", { input1: { kind: "field", fieldId: "b" } }, "[]"),
        formulaSelect("b", { input1: { kind: "field", fieldId: "a" } }, "[]"),
      ],
    });
    expect(R.isFailure(result) && result.error).toContain("a → b → a");
  });

  it("fails on a list sub-field reading its own list", () => {
    const list: ListField = {
      id: "rows",
      type: "input",
      kind: "list",
      label: "Rows",
      fields: [
        formulaSelect(
          "cell",
          {
            input1: {
              kind: "list",
              fieldId: "rows",
              properties: { cell: "cell" },
            },
          },
          "[]",
        ),
      ],
    };
    const result = resolve({ fields: [list] });
    expect(R.isFailure(result) && result.error).toContain("cell → cell");
  });
});

describe("list sub-fields with an options formula", () => {
  const list: ListField = {
    id: "rows",
    type: "input",
    kind: "list",
    label: "Rows",
    fields: [
      formulaMultiselect("cell", { input1: sourceColors }, LATEST),
      { id: "note", type: "input", kind: "text", label: "Note" },
    ],
  };
  const answers: Record<string, FormValue> = {
    rows: [
      { cell: ["red", "green"], note: "x" },
      { cell: ["green"] },
      { note: "y" },
    ],
  };

  it("clears unavailable selections in every row", () => {
    const result = resolve({
      fields: [list],
      answers,
      submissions: [["red", "blue"]],
    });
    expect(R.unwrap(result).answers).toEqual({
      rows: [{ cell: ["red"], note: "x" }, {}, { note: "y" }],
    });
  });

  it("saves the selected choices of every row once, in offered order", () => {
    const schema = schemaOf([list]);
    const options = new Map([
      [
        "cell",
        [
          choice("green", "Green"),
          choice("red", "Red"),
          choice("blue", "Blue"),
        ],
      ],
    ]);
    expect(selectedFormulaChoices({ schema, answers, options })).toEqual({
      cell: [choice("green", "Green"), choice("red", "Red")],
    });
  });

  it("puts resolved options on the sub-field", () => {
    const resolved = schemaWithResolvedOptions(
      schemaOf([list]),
      new Map([["cell", [choice("red")]]]),
    );
    const field = resolved.pages[0].fields[0];
    expect(
      field.type === "input" && field.kind === "list" && field.fields[0],
    ).toMatchObject({
      options: [choice("red")],
    });
  });
});

describe("saved formula choices", () => {
  it("leave a select's answer alone when it is still offered", () => {
    const schema = schemaOf([formulaSelect("pick", {}, "[]")]);
    const answers = { pick: "a" };
    expect(
      keepAvailableChoices({
        schema,
        answers,
        options: new Map([["pick", [choice("a")]]]),
      }),
    ).toBe(answers);
  });

  it("leave a cleared select alone", () => {
    const schema = schemaOf([formulaSelect("pick", {}, "[]")]);
    const answers = { pick: "" };
    expect(
      keepAvailableChoices({
        schema,
        answers,
        options: new Map([["pick", [choice("a")]]]),
      }),
    ).toBe(answers);
  });

  it("name only the choices selected", () => {
    const schema = schemaOf([formulaMultiselect("pick", {}, "[]")]);
    expect(
      selectedFormulaChoices({
        schema,
        answers: { pick: ["b"] },
        options: new Map([["pick", [choice("a"), choice("b")]]]),
      }),
    ).toEqual({ pick: [choice("b")] });
  });

  it("count a selection in any row, but not a cleared select", () => {
    const schema = schemaOf([
      formulaSelect("pick", {}, "[]"),
      {
        id: "rows",
        type: "input",
        kind: "list",
        label: "Rows",
        fields: [formulaMultiselect("cell", {}, "[]")],
      },
    ]);
    expect(
      selectsFormulaChoice(schema, { pick: "", rows: [{ cell: [] }] }),
    ).toBe(false);
    expect(selectsFormulaChoice(schema, { pick: "a" })).toBe(true);
    expect(selectsFormulaChoice(schema, { rows: [{}, { cell: ["b"] }] })).toBe(
      true,
    );
  });
});

describe("options on a formula field's schema", () => {
  it("leaves fixed-option fields as they are when resolving", () => {
    const schema = schemaOf([multiselect("fixed", [choice("a")])]);
    expect(schemaWithResolvedOptions(schema, new Map([["fixed", []]]))).toEqual(
      schema,
    );
  });

  it("offers nothing on a formula field with no resolved options, whatever it stores", () => {
    const schema = schemaOf([
      { ...formulaSelect("pick", {}, "[]"), options: [choice("stale")] },
    ]);
    const [field] = schemaWithResolvedOptions(schema, new Map()).pages[0]
      .fields;
    expect(field).toMatchObject({ options: [] });
  });

  it("replaces each formula, in a list too, with the choices a response saved", () => {
    const saved = schemaWithSavedChoices(
      schemaOf([
        formulaSelect("pick", {}, "[]"),
        {
          id: "rows",
          type: "input",
          kind: "list",
          label: "Rows",
          fields: [formulaMultiselect("cell", {}, "[]")],
        },
      ]),
      { pick: [choice("a")], cell: [choice("b"), choice("c")] },
    );
    const [pick, rows] = saved.pages[0].fields;

    expect(pick).toMatchObject({ options: [choice("a")] });
    expect(
      rows.type === "input" && rows.kind === "list" && rows.fields[0],
    ).toMatchObject({ options: [choice("b"), choice("c")] });
    expect(JSON.stringify(saved)).not.toContain("optionsFormula");
  });
});

describe("readFormulaChoices", () => {
  it("reads a saved choice's category", () => {
    const choices = { pick: [{ ...choice("r"), category: "Warm" }] };
    expect(readFormulaChoices(choices)).toEqual(R.success(choices));
  });

  it("rejects a category that isn't text", () => {
    expect(
      R.isFailure(
        readFormulaChoices({ pick: [{ ...choice("r"), category: 1 }] }),
      ),
    ).toBe(true);
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

describe("syncSchemaListInputs with options formulas", () => {
  it("names a list sub-field an options formula's list input doesn't name yet", () => {
    const list: ListField = {
      id: "people",
      type: "input",
      kind: "list",
      label: "People",
      fields: [
        { id: "name", type: "input", kind: "text", label: "Name" },
        { id: "city", type: "input", kind: "text", label: "Home city" },
      ],
    };
    const schema = schemaOf([
      list,
      formulaSelect(
        "pick",
        {
          input1: {
            kind: "list",
            fieldId: "people",
            properties: { name: "name" },
          },
        },
        "[]",
      ),
    ]);
    const synced = syncSchemaListInputs(schema, new Map());
    const pick = synced.pages[0].fields[1];
    expect(
      pick.type === "input" &&
        pick.kind === "select" &&
        pick.optionsFormula?.inputs.input1,
    ).toEqual({
      kind: "list",
      fieldId: "people",
      properties: { name: "name", city: "homeCity" },
    });
    expect(syncSchemaListInputs(synced, new Map())).toBe(synced);
  });

  it("names a source list's new sub-field for a list sub-field's formula", () => {
    const sourcePeople: ListField = {
      id: "people",
      type: "input",
      kind: "list",
      label: "People",
      fields: [
        { id: "name", type: "input", kind: "text", label: "Name" },
        { id: "city", type: "input", kind: "text", label: "Home city" },
      ],
    };
    const schema = schemaOf([
      {
        id: "rows",
        type: "input",
        kind: "list",
        label: "Rows",
        fields: [
          formulaSelect(
            "cell",
            {
              input1: {
                kind: "sourceList",
                sourceFormId: SOURCE,
                fieldId: "people",
                properties: { name: "name" },
              },
            },
            "[]",
          ),
        ],
      },
    ]);
    const sources = new Map([[SOURCE, [sourcePeople]]]);
    const synced = syncSchemaListInputs(schema, sources);
    const rows = synced.pages[0].fields[0];
    const cell =
      rows.type === "input" && rows.kind === "list" && rows.fields[0];
    expect(
      cell && cell.kind === "select" && cell.optionsFormula?.inputs.input1,
    ).toMatchObject({ properties: { name: "name", city: "homeCity" } });
    expect(syncSchemaListInputs(synced, sources)).toBe(synced);
  });
});
