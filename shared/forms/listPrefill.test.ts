import type { FormSchema } from "@alliance/common/forms/form-schema";
import { prefillListsFromPreviousAnswers } from "./listPrefill";

const schema = (max?: number): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "leads",
          type: "input",
          kind: "list",
          label: "Leads",
          max,
          fields: [{ id: "company", type: "input", kind: "text", label: "C" }],
          prefillFromPreviousAnswer: {
            sourceFormId: 7,
            sourceFieldId: "companies",
            sourceSubFieldId: "name",
            targetSubFieldId: "company",
          },
        },
      ],
    },
  ],
  outputViews: [],
});

const previousAnswerData = {
  7: { companies: [{ name: "Acme" }, { name: "Globex" }, {}] },
};

it("builds a card per source card, copying the mapped sub-field", () => {
  expect(
    prefillListsFromPreviousAnswers({
      schema: schema(),
      previousAnswerData,
      formData: {},
    }).leads,
  ).toEqual([{ company: "Acme" }, { company: "Globex" }, {}]);
});

it("stops at the list's max", () => {
  expect(
    prefillListsFromPreviousAnswers({
      schema: schema(1),
      previousAnswerData,
      formData: {},
    }).leads,
  ).toEqual([{ company: "Acme" }]);
});

it("fills a list holding only the empty cards its defaults made", () => {
  expect(
    prefillListsFromPreviousAnswers({
      schema: schema(),
      previousAnswerData,
      formData: { leads: [{}, {}] },
    }).leads,
  ).toEqual([{ company: "Acme" }, { company: "Globex" }, {}]);
});

it("returns the same answers for an edited list or a missing source", () => {
  const edited = { leads: [{ company: "Mine" }] };
  expect(
    prefillListsFromPreviousAnswers({
      schema: schema(),
      previousAnswerData,
      formData: edited,
    }),
  ).toBe(edited);

  const empty = {};
  expect(
    prefillListsFromPreviousAnswers({
      schema: schema(),
      previousAnswerData: {},
      formData: empty,
    }),
  ).toBe(empty);
});
