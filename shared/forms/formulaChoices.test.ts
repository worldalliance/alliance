import type { FormSchema } from "@alliance/common/forms/form-schema";
import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import { formulaSourcesChanged, formulaSourcesFor } from "./formulaChoices";
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
