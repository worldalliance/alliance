import type { AnyField } from "@alliance/common/forms/form-schema";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { filterDescription } from "./responseFilter";

const pick: AnyField = {
  id: "pick",
  type: "input",
  kind: "multiselect",
  label: "Pick",
  options: [],
  optionsFormula: { inputs: {}, formula: "[]" },
};

const response = makeFormResponse({
  answers: { pick: ["a"] },
  formulaChoices: { pick: [{ label: "Alpha", value: "a" }] },
});

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
