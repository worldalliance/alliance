import type { AnyField } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import { choiceAnswerText } from "./questionAnswer";

const pick: AnyField = {
  id: "pick",
  type: "input",
  kind: "multiselect",
  label: "Pick",
  options: [],
  optionsFormula: { inputs: {}, formula: "[]" },
};

const response = (
  formulaChoices: FormResponseDto["formulaChoices"],
): FormResponseDto => ({
  id: 1,
  formId: 1,
  formSnapshotId: 7,
  answers: {},
  publicAnswers: {},
  createdAt: "2026-03-04T10:00:00.000Z",
  schemaSnapshot: {},
  visibilityValidatorResults: {},
  formulaChoices,
});

it("labels a formula field's answer with the choices its response saved", () => {
  expect(
    choiceAnswerText({
      field: pick,
      value: ["b", "a"],
      response: response({
        pick: [
          { label: "Alpha", value: "a" },
          { label: "Beta", value: "b" },
        ],
      }),
    }),
  ).toBe("Beta, Alpha");
});

it("reads each response's answer in that response's own labels", () => {
  const labelOf = (label: string) =>
    choiceAnswerText({
      field: { ...pick, kind: "select" },
      value: "a",
      response: response({ pick: [{ label, value: "a" }] }),
    });
  expect([labelOf("Alpha"), labelOf("Later label")]).toEqual([
    "Alpha",
    "Later label",
  ]);
});

it("leaves a question without choices to the caller", () => {
  expect(
    choiceAnswerText({
      field: { id: "note", type: "input", kind: "text", label: "Note" },
      value: "hi",
      response: response({}),
    }),
  ).toBeUndefined();
});
