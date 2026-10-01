import type { AnyField } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import { filterDescription } from "./responseFilter";

const pick: AnyField = {
  id: "pick",
  type: "input",
  kind: "multiselect",
  label: "Pick",
  options: [],
  optionsFormula: { inputs: {}, formula: "[]" },
};

const response: FormResponseDto = {
  id: 1,
  formId: 1,
  formSnapshotId: 7,
  answers: { pick: ["a"] },
  publicAnswers: {},
  createdAt: "2026-03-04T10:00:00.000Z",
  schemaSnapshot: {},
  sid: null,
  visibilityValidatorResults: {},
  formulaChoices: { pick: [{ label: "Alpha", value: "a" }] },
};

it("names a formula multiselect's filter with the label its responses saved", () => {
  expect(
    filterDescription({
      filter: { fieldId: "pick", op: "includes", value: "a" },
      field: pick,
      responses: [response],
    }),
  ).toEqual({ fieldLabel: expect.any(String), description: "Includes Alpha" });
});

it("names a formula select's filter with the label its responses saved", () => {
  const choose: AnyField = {
    id: "pick",
    type: "input",
    kind: "select",
    label: "Pick",
    options: [],
    optionsFormula: { inputs: {}, formula: "[]" },
  };
  expect(
    filterDescription({
      filter: { fieldId: "pick", op: "equals", value: "a" },
      field: choose,
      responses: [{ ...response, answers: { pick: "a" } }],
    }),
  ).toEqual({ fieldLabel: expect.any(String), description: "Alpha" });
});
