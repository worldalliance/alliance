import type { AnyField } from "@alliance/common/forms/form-schema";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import {
  filterDescription,
  isResponseFilterOp,
  matchesResponseFilter,
  type FormResponseFilter,
} from "./responseFilter";

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

describe("matchesResponseFilter", () => {
  const checkbox: AnyField = {
    id: "agree",
    type: "input",
    kind: "checkbox",
    label: "Agree",
  };
  const matches = (params: {
    answer: unknown;
    filter: FormResponseFilter;
    field: AnyField;
  }) =>
    matchesResponseFilter(
      makeFormResponse({ answers: { [params.field.id]: params.answer } }),
      params.filter,
      params.field,
    );

  it("matches a checkbox against the boolean its value names", () => {
    const filter = { fieldId: "agree", op: "equals", value: "true" } as const;
    expect(matches({ answer: 1, filter, field: checkbox })).toBe(true);
    expect(matches({ answer: false, filter, field: checkbox })).toBe(false);
    expect(matches({ answer: "maybe", filter, field: checkbox })).toBe(false);
  });

  it("matches a multiselect that includes the value", () => {
    const filter = { fieldId: "pick", op: "includes", value: "a" } as const;
    expect(matches({ answer: ["b", "a"], filter, field: pick })).toBe(true);
    expect(matches({ answer: ["b"], filter, field: pick })).toBe(false);
  });

  it("matches a select whose answer equals the value", () => {
    const choose: AnyField = { ...pick, kind: "select" };
    const filter = { fieldId: "pick", op: "equals", value: "a" } as const;
    expect(matches({ answer: "a", filter, field: choose })).toBe(true);
    expect(matches({ answer: "", filter, field: choose })).toBe(false);
  });

  it("matches a numeric range answer against the value's text", () => {
    const range: AnyField = {
      id: "score",
      type: "input",
      kind: "range",
      label: "Score",
      optionCount: 5,
    };
    const matching = { fieldId: "score", op: "equals", value: "3" } as const;
    expect(matches({ answer: 3, filter: matching, field: range })).toBe(true);
    expect(
      matches({ answer: 3, filter: { ...matching, value: "4" }, field: range }),
    ).toBe(false);
  });

  it("matches no-response on an empty answer of any kind", () => {
    const filter = { fieldId: "agree", op: "no-response" } as const;
    expect(matches({ answer: {}, filter, field: checkbox })).toBe(true);
    expect(matches({ answer: false, filter, field: checkbox })).toBe(false);
  });

  it("matches nothing when the op does not fit the field kind", () => {
    const filter = { fieldId: "agree", op: "includes", value: "true" } as const;
    expect(matches({ answer: true, filter, field: checkbox })).toBe(false);
  });
});

it("accepts only the known filter ops", () => {
  expect(isResponseFilterOp("no-response")).toBe(true);
  expect(isResponseFilterOp("contains")).toBe(false);
  expect(isResponseFilterOp(null)).toBe(false);
});
