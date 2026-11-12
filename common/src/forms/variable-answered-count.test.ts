import { describe, expect, it } from "bun:test";
import type { AnyField, FileField, FormSchema, ListField } from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";
import {
  answeredSourceKey,
  variableAggregateSources,
  variableAnsweredSources,
  variableCountKeys,
  type VariableCount,
} from "./variable-aggregates";
import { evaluateVariable } from "./variable-evaluation";
import { variableInputSchema } from "./variable-inputs";
import type { FormVariable } from "./variables";

const SOURCE = 7;

const photos: FileField = {
  id: "photos",
  type: "input",
  kind: "file",
  label: "Upload your photos",
};

const answeredInput = {
  kind: "answeredCount",
  sourceFormId: SOURCE,
  fieldId: "photos",
} as const;

const PLURAL = "input1 === 1 ? '1 member' : input1 + ' members'";

const answeredVariable = (formula = PLURAL): FormVariable => ({
  name: "num_completions",
  inputs: { input1: answeredInput },
  formula,
});

const evaluate = (aggregates?: ReadonlyMap<string, VariableCount>) =>
  evaluateVariable(answeredVariable(), {
    answers: {},
    fields: new Map(),
    aggregates,
  });

const destination = (
  variables: FormVariable[],
  overrides: Partial<FormSchema> = {},
): FormSchema => ({
  pages: [{ id: "p1", fields: [] }],
  outputViews: [],
  variables,
  ...overrides,
});

const messages = (schema: FormSchema, sourceFields: AnyField[] = [photos]) =>
  validateFormSchema(schema, {
    sourceForms: new Map([[SOURCE, sourceFields]]),
  }).map(({ message }) => message);

describe("variableInputSchema for members-who-answered inputs", () => {
  it("accepts a source form and question, and nothing more", () => {
    expect(variableInputSchema.safeParse(answeredInput).success).toBe(true);
    expect(
      variableInputSchema.safeParse({ ...answeredInput, properties: {} })
        .success,
    ).toBe(false);
  });
});

describe("evaluateVariable with a members-who-answered input", () => {
  it("reads the count as a number", () => {
    const key = answeredSourceKey(answeredInput);
    expect(evaluate(new Map([[key, 1]]))).toEqual({
      ok: true,
      value: "1 member",
    });
    expect(evaluate(new Map([[key, 12]]))).toEqual({
      ok: true,
      value: "12 members",
    });
  });

  it("fails rather than reading a count it wasn't given as zero", () => {
    expect(evaluate(new Map()).ok).toBe(false);
    expect(evaluate().ok).toBe(false);
  });

  it("keeps its count apart from an aggregate on the same question", () => {
    const counts = new Map([[`${SOURCE}:photos`, { x: 1 }]]);
    expect(evaluate(counts).ok).toBe(false);
  });
});

describe("validateFormSchema with members-who-answered inputs", () => {
  it("accepts any question outside a list, a file upload included", () => {
    expect(messages(destination([answeredVariable()]))).toEqual([]);
  });

  it("types the count as a number", () => {
    expect(
      messages(destination([answeredVariable("input1.toUpperCase()")])),
    ).toHaveLength(1);
  });

  it("rejects a question the source form no longer has", () => {
    expect(messages(destination([answeredVariable()]), [])).toEqual([
      `Input "input1" references field "photos", which form ${SOURCE} no longer has`,
    ]);
  });

  it("rejects a question with none picked", () => {
    const variable: FormVariable = {
      ...answeredVariable(),
      inputs: { input1: { ...answeredInput, fieldId: "" } },
    };
    expect(messages(destination([variable]))).toEqual([
      'Input "input1" has no question picked',
    ]);
  });

  it("rejects a question inside a list", () => {
    const list: ListField = {
      id: "jobs",
      type: "input",
      kind: "list",
      label: "Jobs",
      fields: [{ ...photos, kind: "text" }],
    };
    expect(messages(destination([answeredVariable()]), [list])).toEqual([
      'Input "input1" reads field "photos", which is inside a list. Only a question outside a list can be counted',
    ]);
  });

  it("rejects the variable in shared output", () => {
    expect(
      messages(
        destination([answeredVariable()], {
          outputViews: [
            {
              id: "view",
              type: "default",
              blocks: [
                {
                  id: "text",
                  type: "display",
                  kind: "text",
                  text: "#{num_completions}",
                },
              ],
            },
          ],
        }),
      ),
    ).toEqual([
      "Output views can't show #{num_completions}, which reads submitted answers",
    ]);
  });
});

describe("count source discovery", () => {
  it("lists members-who-answered sources apart from aggregate sources", () => {
    const variables: FormVariable[] = [
      answeredVariable(),
      {
        name: "both",
        inputs: {
          input1: answeredInput,
          input2: { kind: "aggregate", sourceFormId: SOURCE, fieldId: "e" },
        },
        formula: "input1",
      },
    ];
    expect(variableAnsweredSources(variables)).toEqual([
      { sourceFormId: SOURCE, fieldId: "photos" },
    ]);
    expect(variableAggregateSources(variables)).toEqual([
      { sourceFormId: SOURCE, fieldId: "e" },
    ]);
    expect(variableCountKeys(variables)).toEqual([
      `${SOURCE}:e`,
      `answered:${SOURCE}:photos`,
    ]);
  });
});
