import type { FormSchema, FormValue } from "@alliance/common/forms/form-schema";
import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import { renderHook } from "@testing-library/react";
import { useEffect, useState } from "react";
import {
  formulaSourcesChanged,
  formulaSourcesFor,
  offeredChoices,
  useDropUnofferedChoices,
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

const fromLocalSchema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "source",
          type: "input",
          kind: "multiselect",
          label: "Source",
          options: [{ label: "A", value: "a" }],
        },
        {
          id: "picked",
          type: "input",
          kind: "multiselect",
          label: "Picked",
          options: [],
          optionsFormula: {
            inputs: { input1: { kind: "field", fieldId: "source" } },
            formula: "input1 ?? [{ label: 'X', value: 'x' }]",
          },
        },
      ],
    },
  ],
  outputViews: [],
};

describe("useDropUnofferedChoices", () => {
  it("checks answers restored in the same commit against those answers", () => {
    const restored = { source: ["a"], picked: ["a"] };
    const { result } = renderHook(() => {
      const [formData, setFormData] = useState<Record<string, FormValue>>({});
      useEffect(() => setFormData(restored), []);
      useDropUnofferedChoices({
        schema: fromLocalSchema,
        readOnly: false,
        formData,
        offeredChoicesFor: (answers) =>
          offeredChoices({
            schema: fromLocalSchema,
            answers,
            extras: { deviceType: "desktop" },
            sources: new Map(),
          }),
        setFormData,
      });
      return formData;
    });

    expect(result.current).toEqual(restored);
  });

  it("leaves the answers alone while a formula fails", () => {
    const failing: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "picked",
              type: "input",
              kind: "multiselect",
              label: "Picked",
              options: [],
              optionsFormula: { inputs: {}, formula: "'not a list'" },
            },
          ],
        },
      ],
      outputViews: [],
    };
    const stored = { picked: ["a"] };
    const offered = (answers: Record<string, FormValue>) =>
      offeredChoices({
        schema: failing,
        answers,
        extras: { deviceType: "desktop" },
        sources: new Map(),
      });
    expect(offered(stored)).toBeUndefined();

    const { result } = renderHook(() => {
      const [formData, setFormData] =
        useState<Record<string, FormValue>>(stored);
      useDropUnofferedChoices({
        schema: failing,
        readOnly: false,
        formData,
        offeredChoicesFor: offered,
        setFormData,
      });
      return formData;
    });

    expect(result.current).toEqual(stored);
  });
});

describe("offeredChoices", () => {
  it("keeps a choice offered only while the answer it reads is hidden", () => {
    const hidden: FormSchema = {
      ...fromLocalSchema,
      pages: [
        {
          id: "p1",
          fields: fromLocalSchema.pages[0].fields.map((field) =>
            field.type === "input" && field.id === "source"
              ? {
                  ...field,
                  visibleIfFormula: {
                    conditions: {
                      c1: { kind: "equals", when: "picked", equals: "never" },
                    },
                    formula: "c1",
                  },
                }
              : field,
          ),
        },
      ],
    };

    const options = offeredChoices({
      schema: hidden,
      answers: { source: ["a"], picked: ["x"] },
      extras: { deviceType: "desktop" },
      sources: new Map(),
    });

    expect(options?.get("picked")?.map(({ value }) => value)).toEqual([
      "a",
      "x",
    ]);
  });
  it("drops nothing while a hidden answer fails the formula", () => {
    const hiddenText: FormSchema = {
      ...fromLocalSchema,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "source",
              type: "input",
              kind: "text",
              label: "Source",
              visibleIfFormula: {
                conditions: {
                  c1: { kind: "equals", when: "picked", equals: "never" },
                },
                formula: "c1",
              },
            },
            fromLocalSchema.pages[0].fields[1],
          ],
        },
      ],
    };

    const options = offeredChoices({
      schema: hiddenText,
      answers: { source: "not a list", picked: ["x"] },
      extras: { deviceType: "desktop" },
      sources: new Map(),
    });

    expect(options).toBeUndefined();
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
