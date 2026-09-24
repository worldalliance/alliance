import { describe, expect, it } from "bun:test";
import type {
  AnyField,
  FormSchema,
  FormValue,
  ListField,
  NumberField,
  RadioField,
  TextField,
} from "./form-schema";
import { variableInputFieldsById } from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";
import { resolveOutputBlocks } from "./output-resolution";
import {
  evaluateVariable,
  type VariableSourceHistory,
} from "./variable-evaluation";
import { variableInputSchema } from "./variable-inputs";
import { syncSchemaVariableListInputs } from "./variable-scope";
import {
  variableSourceFormIds,
  variableTypeEnv,
  type FormVariable,
} from "./variables";

const SOURCE = 7;

const numberField = (id: string): NumberField => ({
  id,
  type: "input",
  kind: "number",
  label: id,
});

const textField = (id: string): TextField => ({
  id,
  type: "input",
  kind: "text",
  label: id,
});

const radioField = (
  id: string,
  options: { label: string; value: string }[],
): RadioField => ({ id, type: "input", kind: "radio", label: id, options });

const people: ListField = {
  id: "people",
  type: "input",
  kind: "list",
  label: "People",
  fields: [
    { id: "name", type: "input", kind: "text", label: "Name" },
    { id: "age", type: "input", kind: "number", label: "Age" },
  ],
};

const peopleInput = {
  kind: "sourceList",
  fieldId: "people",
  sourceFormId: SOURCE,
  properties: { name: "name", age: "age" },
} as const;

const history = (
  fields: AnyField[],
  answers: Record<string, FormValue>[],
): VariableSourceHistory => ({
  fields: variableInputFieldsById(fields),
  responses: answers.map((response) => ({
    answers: response,
    fields: variableInputFieldsById(fields),
  })),
});

const evaluate = (params: {
  variable: FormVariable;
  sources: ReadonlyMap<number, VariableSourceHistory>;
  answers?: Record<string, number>;
  fields?: AnyField[];
}) =>
  evaluateVariable(params.variable, {
    answers: params.answers ?? {},
    fields: variableInputFieldsById(params.fields ?? []),
    sources: params.sources,
  });

const scoresVariable = (formula: string): FormVariable => ({
  name: "scores",
  inputs: {
    input1: { kind: "sourceField", fieldId: "score", sourceFormId: SOURCE },
  },
  formula,
});

const SHOW_SCORES = 'input1.map(n => n ?? "-").join(",")';

describe("variableInputSchema for inputs from another form", () => {
  it("needs a kind of its own, so a build predating it fails instead of reading this form", () => {
    expect(
      variableInputSchema.safeParse({
        kind: "field",
        fieldId: "score",
        sourceFormId: SOURCE,
      }).success,
    ).toBe(false);
    expect(
      variableInputSchema.safeParse({
        kind: "sourceField",
        fieldId: "score",
        sourceFormId: SOURCE,
      }).success,
    ).toBe(true);
  });

  it("rejects a form id past a Postgres integer", () => {
    const input = (sourceFormId: number) => ({
      kind: "sourceField",
      fieldId: "score",
      sourceFormId,
    });
    expect(variableInputSchema.safeParse(input(2_147_483_647)).success).toBe(
      true,
    );
    expect(variableInputSchema.safeParse(input(2_147_483_648)).success).toBe(
      false,
    );
  });
});

describe("evaluateVariable with inputs from another form", () => {
  it("gives an empty list for no submissions", () => {
    expect(
      evaluate({
        variable: {
          name: "counts",
          inputs: {
            input1: {
              kind: "sourceField",
              fieldId: "score",
              sourceFormId: SOURCE,
            },
            input2: peopleInput,
          },
          formula: 'input1.length + "/" + input2.length',
        },
        sources: new Map([[SOURCE, history([numberField("score")], [])]]),
      }),
    ).toEqual({ ok: true, value: "0/0" });
  });

  it("keeps one position per submission, oldest first, unanswered included", () => {
    expect(
      evaluate({
        variable: scoresVariable(SHOW_SCORES),
        sources: new Map([
          [
            SOURCE,
            history([numberField("score")], [{ score: 5 }, {}, { score: "8" }]),
          ],
        ]),
      }),
    ).toEqual({ ok: true, value: "5,-,8" });
  });

  it("keeps each submission's rows as their own list, and an unanswered list as []", () => {
    expect(
      evaluate({
        variable: {
          name: "rows",
          inputs: { input1: peopleInput },
          formula:
            'input1.map(rows => rows.map(row => row.name + ":" + (row.age ?? "?")).join("+")).join("|")',
        },
        sources: new Map([
          [
            SOURCE,
            history(
              [people],
              [
                {},
                { people: [{ name: "Ada", age: 36 }, { name: "Bo" }] },
                { people: [] },
              ],
            ),
          ],
        ]),
      }),
    ).toEqual({ ok: true, value: "|Ada:36+Bo:?|" });
  });

  it("aligns inputs from the same form by submission and combines them with a local input", () => {
    expect(
      evaluate({
        variable: {
          name: "combined",
          inputs: {
            input1: {
              kind: "sourceField",
              fieldId: "score",
              sourceFormId: SOURCE,
            },
            input2: {
              kind: "sourceField",
              fieldId: "note",
              sourceFormId: SOURCE,
            },
            input3: { kind: "field", fieldId: "bonus" },
          },
          formula:
            'input1.map((n, i) => (input2[i] ?? "-") + "=" + ((n ?? 0) + input3)).join(",")',
        },
        answers: { bonus: 1 },
        fields: [numberField("bonus")],
        sources: new Map([
          [
            SOURCE,
            history(
              [numberField("score"), textField("note")],
              [{ note: "a" }, { score: 4 }, { score: 2, note: "c" }],
            ),
          ],
        ]),
      }),
    ).toEqual({ ok: true, value: "a=1,-=5,c=3" });
  });

  it("reads each answer's option label from the form version it was submitted against", () => {
    const current = radioField("color", [{ label: "Crimson", value: "red" }]);
    const original = radioField("color", [{ label: "Red", value: "red" }]);
    expect(
      evaluate({
        variable: {
          name: "colors",
          inputs: {
            input1: {
              kind: "sourceField",
              fieldId: "color",
              sourceFormId: SOURCE,
            },
          },
          formula: 'input1.map(c => c?.label).join(",")',
        },
        sources: new Map([
          [
            SOURCE,
            {
              fields: variableInputFieldsById([current]),
              responses: [
                {
                  answers: { color: "red" },
                  fields: variableInputFieldsById([original]),
                },
                {
                  answers: { color: "red" },
                  fields: variableInputFieldsById([current]),
                },
              ],
            },
          ],
        ]),
      }),
    ).toEqual({ ok: true, value: "Red,Crimson" });
  });

  it("reads a question the source form has since removed from each submission's own version", () => {
    expect(
      evaluate({
        variable: scoresVariable(SHOW_SCORES),
        sources: new Map([
          [
            SOURCE,
            {
              fields: new Map(),
              responses: [
                {
                  answers: { score: 3 },
                  fields: variableInputFieldsById([numberField("score")]),
                },
              ],
            },
          ],
        ]),
      }),
    ).toEqual({ ok: true, value: "3" });
  });

  it("fails rather than read an answer given when the question had another type", () => {
    const result = evaluate({
      variable: scoresVariable(SHOW_SCORES),
      sources: new Map([
        [
          SOURCE,
          {
            fields: variableInputFieldsById([numberField("score")]),
            responses: [
              {
                answers: { score: "high" },
                fields: variableInputFieldsById([textField("score")]),
              },
            ],
          },
        ],
      ]),
    });
    expect(result.ok).toBe(false);
  });

  it("reads an answer given when the question had another kind of the same type", () => {
    expect(
      evaluate({
        variable: scoresVariable(SHOW_SCORES),
        sources: new Map([
          [
            SOURCE,
            {
              fields: variableInputFieldsById([
                {
                  id: "score",
                  type: "input",
                  kind: "textarea",
                  label: "score",
                },
              ]),
              responses: [
                {
                  answers: { score: "high" },
                  fields: variableInputFieldsById([textField("score")]),
                },
              ],
            },
          ],
        ]),
      }),
    ).toEqual({ ok: true, value: "high" });
  });

  it("fails rather than read a list row whose sub-field had another type", () => {
    const peopleWithTextAge: ListField = {
      ...people,
      fields: [textField("name"), textField("age")],
    };
    const result = evaluate({
      variable: { name: "rows", inputs: { input1: peopleInput }, formula: "0" },
      sources: new Map([
        [
          SOURCE,
          {
            fields: variableInputFieldsById([people]),
            responses: [
              {
                answers: { people: [{ name: "Ada", age: "old" }] },
                fields: variableInputFieldsById([peopleWithTextAge]),
              },
            ],
          },
        ],
      ]),
    });
    expect(result.ok).toBe(false);
  });

  it("fails when the source form's answers were never loaded", () => {
    expect(
      evaluate({ variable: scoresVariable(SHOW_SCORES), sources: new Map() }),
    ).toEqual({
      ok: false,
      error: `Answers from form ${SOURCE} are not loaded`,
    });
  });
});

describe("variableTypeEnv with inputs from another form", () => {
  it("wraps the input's type in a list with one element per submission", () => {
    const types = variableTypeEnv(
      {
        name: "v",
        inputs: {
          input1: {
            kind: "sourceField",
            fieldId: "score",
            sourceFormId: SOURCE,
          },
          input2: peopleInput,
          input3: { kind: "field", fieldId: "score" },
          input4: { kind: "sourceField", fieldId: "score", sourceFormId: 99 },
        },
        formula: "0",
      },
      {
        fields: variableInputFieldsById([textField("score")]),
        sourceFields: new Map([
          [SOURCE, variableInputFieldsById([numberField("score"), people])],
        ]),
      },
    );
    expect(Object.fromEntries(types)).toEqual({
      input1: "(number | undefined)[]",
      input2: "({ name: string | undefined; age: number | undefined }[])[]",
      input3: "string | undefined",
      input4: "any",
    });
  });
});

describe("validateFormSchema with inputs from another form", () => {
  const destination = (
    variables: FormVariable[],
    overrides: Partial<FormSchema> = {},
  ): FormSchema => ({
    pages: [{ id: "p1", fields: [numberField("bonus")] }],
    outputViews: [],
    variables,
    ...overrides,
  });
  const sourceForms = new Map([[SOURCE, [numberField("score"), people]]]);
  const messages = (schema: FormSchema, formId?: number) =>
    validateFormSchema(schema, { formId, sourceForms }).map(
      (error) => error.message,
    );

  it("types the formula against the source form's fields", () => {
    expect(messages(destination([scoresVariable(SHOW_SCORES)]))).toEqual([]);
    expect(messages(destination([scoresVariable("input1")]))[0]).toContain(
      "A formula has to end on text",
    );
  });

  it("rejects a source form that couldn't be loaded", () => {
    expect(
      validateFormSchema(destination([scoresVariable(SHOW_SCORES)])).map(
        (error) => error.message,
      ),
    ).toEqual([
      `Input "input1" reads form ${SOURCE}, which doesn't exist or couldn't be loaded`,
    ]);
  });

  it("names an input with no question picked", () => {
    expect(
      messages(
        destination([
          {
            name: "unpicked",
            inputs: {
              input1: {
                kind: "sourceField",
                fieldId: "",
                sourceFormId: SOURCE,
              },
            },
            formula: "input1.length",
          },
        ]),
      ),
    ).toEqual(['Input "input1" has no question picked']);
  });

  it("rejects a question the source form no longer has", () => {
    expect(
      messages(
        destination([
          {
            name: "gone",
            inputs: {
              input1: {
                kind: "sourceField",
                fieldId: "gone",
                sourceFormId: SOURCE,
              },
            },
            formula: "input1.length",
          },
        ]),
      ),
    ).toEqual([
      `Input "input1" references field "gone", which form ${SOURCE} no longer has`,
    ]);
  });

  it("rejects the form reading itself as a source", () => {
    expect(
      messages(destination([scoresVariable(SHOW_SCORES)]), SOURCE),
    ).toEqual([
      `Input "input1" reads this form as another form. Pick "This form" instead`,
    ]);
  });

  it("rejects a list input's missing property names on the source list", () => {
    expect(
      messages(
        destination([
          {
            name: "rows",
            inputs: { input1: { ...peopleInput, properties: { name: "n" } } },
            formula: "input1.length",
          },
        ]),
      ),
    ).toEqual([`Input "input1" has no property name for sub-field "age"`]);
  });

  it("rejects the variable in every text an output view renders, and allows a local one", () => {
    const local: FormVariable = {
      name: "local",
      inputs: { input1: { kind: "field", fieldId: "bonus" } },
      formula: "input1 ?? 0",
    };
    const labelled: NumberField = {
      ...numberField("bonus"),
      label: "Bonus #{scores}",
      description: "#{local}",
    };
    const errors = validateFormSchema(
      destination([scoresVariable(SHOW_SCORES), local], {
        pages: [{ id: "p1", fields: [labelled] }],
        outputViews: [
          {
            id: "view",
            type: "default",
            blocks: [
              { id: "text", type: "display", kind: "text", text: "#{scores}" },
              { id: "field", fieldId: "bonus", labelOverride: "#{scores}!" },
              { id: "local", type: "display", kind: "text", text: "#{local}" },
            ],
          },
        ],
      }),
      { sourceForms },
    );
    expect(errors).toEqual(
      ["text.text", "field.labelOverride", "bonus.label"].map((blockId) => ({
        viewId: "view",
        blockId,
        message:
          "Output views can't show #{scores}, which reads answers from another form",
      })),
    );
  });
});

describe("resolveOutputBlocks with a variable reading another form", () => {
  it("leaves that variable unresolved and resolves the rest", () => {
    const resolved = resolveOutputBlocks({
      schema: {
        pages: [{ id: "p1", fields: [numberField("bonus")] }],
        outputViews: [
          {
            id: "view",
            type: "default",
            blocks: [
              {
                id: "text",
                type: "display",
                kind: "text",
                text: "#{scores} #{local}",
              },
            ],
          },
        ],
        variables: [
          scoresVariable(SHOW_SCORES),
          {
            name: "local",
            inputs: { input1: { kind: "field", fieldId: "bonus" } },
            formula: "input1 ?? 0",
          },
        ],
      },
      answers: { bonus: 2 },
    });
    expect(resolved && Object.fromEntries(resolved.variableValues)).toEqual({
      local: "2",
    });
  });
});

describe("syncSchemaVariableListInputs with inputs from another form", () => {
  const schema: FormSchema = {
    pages: [{ id: "p1", fields: [] }],
    outputViews: [],
    variables: [
      {
        name: "rows",
        inputs: { input1: { ...peopleInput, properties: { name: "name" } } },
        formula: "0",
      },
    ],
  };

  it("names the source list's sub-fields the input doesn't have yet", () => {
    expect(
      syncSchemaVariableListInputs(schema, new Map([[SOURCE, [people]]]))
        .variables?.[0].inputs.input1,
    ).toEqual(peopleInput);
  });

  it("leaves the input alone while its source form isn't loaded", () => {
    expect(syncSchemaVariableListInputs(schema, new Map())).toBe(schema);
  });
});

describe("variableSourceFormIds", () => {
  it("lists each form the variables read once, in ascending order", () => {
    expect(
      variableSourceFormIds([
        {
          name: "a",
          inputs: {
            input1: { kind: "sourceField", fieldId: "score", sourceFormId: 9 },
            input2: { kind: "field", fieldId: "local" },
            input3: { ...peopleInput, sourceFormId: 3 },
          },
          formula: "1",
        },
        scoresVariable("1"),
        {
          name: "b",
          inputs: {
            input1: { kind: "sourceField", fieldId: "other", sourceFormId: 9 },
          },
          formula: "1",
        },
      ]),
    ).toEqual([3, SOURCE, 9]);
  });

  it("is empty for variables reading only this form", () => {
    expect(
      variableSourceFormIds([
        {
          name: "a",
          inputs: { input1: { kind: "field", fieldId: "local" } },
          formula: "1",
        },
      ]),
    ).toEqual([]);
    expect(variableSourceFormIds(undefined)).toEqual([]);
  });
});
