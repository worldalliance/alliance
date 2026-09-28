import type { FormSchema } from "@alliance/common/forms/form-schema";
import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import {
  formulaSourcesChanged,
  formulaSourcesFor,
  visibleOfferedAnswers,
} from "./formulaChoices";
import {
  SourceHistoriesStatus,
  type SourceHistories,
} from "./useVariableSourceHistories";

describe("formulaSourcesFor", () => {
  const readingForms = (...formIds: number[]): FormSchema => ({
    pages: [
      {
        id: "p1",
        fields: formIds.map((formId) => ({
          id: `from${formId}`,
          type: "input",
          kind: "select",
          label: `From ${formId}`,
          options: [],
          optionsFormula: {
            inputs: {
              input1: {
                kind: "sourceField",
                sourceFormId: formId,
                fieldId: "x",
              },
            },
            formula: "input1.at(-1) ?? []",
          },
        })),
      },
    ],
    outputViews: [],
  });

  it.each<[string, SourceHistories]>([
    ["loading", { status: SourceHistoriesStatus.Loading }],
    ["failed", { status: SourceHistoriesStatus.Failed, retry: () => {} }],
    [
      "missing a deleted form",
      {
        status: SourceHistoriesStatus.SourceDeleted,
        sources: new Map(),
        deletedFormIds: new Set([7]),
      },
    ],
  ])("names nothing while the histories are %s", (_, histories) => {
    expect(formulaSourcesFor(readingForms(7), histories)).toBeUndefined();
  });

  it("names each source form's responses, and none for a form with none", () => {
    const response = (id: number) => ({ id, answers: {}, fields: new Map() });
    expect(
      formulaSourcesFor(readingForms(7, 8), {
        status: SourceHistoriesStatus.Ready,
        sources: new Map([
          [7, { fields: new Map(), responses: [response(100), response(101)] }],
          [8, { fields: new Map(), responses: [] }],
        ]),
      }),
    ).toEqual([
      { formId: 7, responseIds: [100, 101] },
      { formId: 8, responseIds: [] },
    ]);
  });
});

const pickedB = { kind: "equals" as const, when: "pick", equals: "b" };

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "pick",
          type: "input",
          kind: "select",
          label: "Pick",
          options: [],
          optionsFormula: {
            inputs: {},
            formula: "[{ label: 'A', value: 'a' }]",
          },
        },
        {
          id: "unlessB",
          type: "input",
          kind: "text",
          label: "Unless B",
          visibleIfFormula: {
            conditions: { c1: pickedB },
            formula: { op: "NOT", operand: "c1" },
          },
        },
        {
          id: "ifB",
          type: "input",
          kind: "text",
          label: "If B",
          visibleIfFormula: { conditions: { c1: pickedB }, formula: "c1" },
        },
      ],
    },
  ],
  outputViews: [],
};

describe("visibleOfferedAnswers", () => {
  it("keeps a hidden field's selection until a pass shows it", () => {
    const unlessB = {
      conditions: { c1: pickedB },
      formula: { op: "NOT" as const, operand: "c1" },
    };
    const { answers } = visibleOfferedAnswers({
      schema: {
        ...schema,
        pages: [
          {
            id: "p1",
            fields: [
              schema.pages[0].fields[0],
              {
                id: "src",
                type: "input",
                kind: "text",
                label: "Src",
                visibleIfFormula: unlessB,
              },
              {
                id: "fromSrc",
                type: "input",
                kind: "select",
                label: "From src",
                options: [],
                optionsFormula: {
                  inputs: { input1: { kind: "field", fieldId: "src" } },
                  formula: "[{ label: 'X', value: input1 ?? 'none' }]",
                },
                visibleIfFormula: unlessB,
              },
            ],
          },
        ],
      },
      answers: { pick: "b", src: "x", fromSrc: "x" },
      extras: { deviceType: "desktop" },
      sources: new Map(),
    });

    expect(answers).toEqual({ src: "x", fromSrc: "x" });
  });

  it("decides visibility without the selections the formula doesn't offer", () => {
    const { answers } = visibleOfferedAnswers({
      schema,
      answers: { pick: "b", unlessB: "kept", ifB: "dropped" },
      extras: { deviceType: "desktop" },
      sources: new Map(),
    });

    expect(answers).toEqual({ unlessB: "kept" });
  });

  it("decides a list row's visibility without the choice its other row hides", () => {
    const { answers } = visibleOfferedAnswers({
      schema: {
        pages: [
          {
            id: "p1",
            fields: [
              {
                id: "items",
                type: "input",
                kind: "list",
                label: "Items",
                fields: [
                  { id: "mode", type: "input", kind: "text", label: "Mode" },
                  {
                    id: "pick",
                    type: "input",
                    kind: "select",
                    label: "Pick",
                    options: [],
                    optionsFormula: {
                      inputs: {},
                      formula: "[{ label: 'A', value: 'a' }]",
                    },
                    visibleIfFormula: {
                      conditions: {
                        c1: { kind: "equals", when: "mode", equals: "show" },
                      },
                      formula: "c1",
                    },
                  },
                  {
                    id: "unlessB",
                    type: "input",
                    kind: "text",
                    label: "Unless B",
                    visibleIfFormula: {
                      conditions: { c1: pickedB },
                      formula: { op: "NOT", operand: "c1" },
                    },
                  },
                  {
                    id: "ifB",
                    type: "input",
                    kind: "text",
                    label: "If B",
                    visibleIfFormula: {
                      conditions: { c1: pickedB },
                      formula: "c1",
                    },
                  },
                ],
              },
            ],
          },
        ],
        outputViews: [],
      },
      answers: {
        items: [
          { mode: "hide", pick: "a" },
          { mode: "show", pick: "b", unlessB: "kept", ifB: "dropped" },
        ],
      },
      extras: { deviceType: "desktop" },
      sources: new Map(),
    });

    expect(answers).toEqual({
      items: [{ mode: "hide" }, { mode: "show", unlessB: "kept" }],
    });
  });
});

describe("formulaSourcesChanged", () => {
  const conflict = (message: string) => ({
    response: new Response(null, { status: 409 }),
    error: { statusCode: 409, message },
  });

  it("keeps the refusal's text, which installed apps match on", () => {
    expect(FORMULA_SOURCES_CHANGED).toBe(
      "Your answers to another form changed since you opened this one. Reload it to see its current options.",
    );
  });

  it("reads the server's refusal when the histories changed", () => {
    expect(formulaSourcesChanged(conflict(FORMULA_SOURCES_CHANGED))).toBe(true);
  });

  it("reads no other conflict as it", () => {
    expect(formulaSourcesChanged(conflict("Already submitted"))).toBe(false);
  });

  it("reads no other failure as it", () => {
    expect(
      formulaSourcesChanged({
        response: new Response(null, { status: 400 }),
        error: { statusCode: 400, message: FORMULA_SOURCES_CHANGED },
      }),
    ).toBe(false);
  });
});
