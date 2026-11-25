import type { FormSchema, ListField } from "@alliance/common/forms/form-schema";
import { NO_OPTIONS } from "@alliance/common/forms/formula-options";
import { CARD_ID_KEY } from "@alliance/shared/forms/listCards";
import { useOutputItems } from "@alliance/shared/useOutputItems";
import { renderHook } from "@testing-library/react";
import { previewFormResponse } from "./previewFormResponse";

const kids: ListField = {
  id: "kids",
  type: "input",
  kind: "list",
  label: "Kids",
  fields: [{ id: "name", type: "input", kind: "text", label: "Name" }],
};
const schema: FormSchema = {
  pages: [{ id: "p1", fields: [kids] }],
  outputViews: [
    {
      type: "default",
      id: "v1",
      blocks: [
        {
          id: "thanks",
          type: "display",
          kind: "text",
          text: "Thanks",
          visibleIfFormula: {
            conditions: { c1: { kind: "validator", validatorId: 7 } },
            formula: "c1",
          },
        },
      ],
    },
  ],
};
const preview = () =>
  previewFormResponse({
    schema,
    formId: 1,
    formSnapshotId: 2,
    answers: { kids: [{ name: "Ada", [CARD_ID_KEY]: "c0" }], removed: "x" },
    fieldLookup: new Map([["kids", kids]]),
    publicAnswers: {},
    options: NO_OPTIONS,
    visibilityValidatorResults: { 7: true },
    deviceType: "mobile",
  });

it("keeps only the answers a submit would send", () => {
  expect(preview().answers).toEqual({ kids: [{ name: "Ada" }] });
});

it("shows the output blocks the member's validator verdicts allow", () => {
  const items = renderHook(() =>
    useOutputItems({ submission: preview(), ownView: true }),
  ).result.current;
  expect(items.map((item) => item.type)).toContain("display");
});

it("keeps the device type the form ran with", () => {
  expect(preview().deviceType).toBe("mobile");
});
