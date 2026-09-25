import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { renderHook } from "@testing-library/react";
import type { FormResponseOutputDto } from "./client";
import { useOutputItems, type OutputSource } from "./useOutputItems";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [{ id: "name", type: "input", kind: "text", label: "Name" }],
    },
  ],
  outputViews: [
    {
      type: "default",
      id: "v1",
      blocks: [{ id: "b1", fieldId: "name", showLabel: true }],
    },
  ],
};

const submission: FormResponseOutputDto = {
  id: 1,
  formId: 1,
  answers: { name: "Stored" },
  publicAnswers: { name: true },
  schemaSnapshot: {},
  visibilityValidatorResults: {},
};

const gatedOn = (condition: Condition): FormSchema => ({
  ...schema,
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "name",
          type: "input",
          kind: "text",
          label: "Name",
          visibleIfFormula: {
            conditions: { condition1: condition },
            formula: "condition1",
          },
        },
      ],
    },
  ],
});

const values = (source: OutputSource) =>
  renderHook(() => useOutputItems(source)).result.current.map((item) =>
    item.type === "field" ? item.value : item.block.kind,
  );

describe("useOutputItems", () => {
  it("reads the answers stored on the submission", () => {
    expect(values({ schema, submission, viewId: "v1" })).toEqual(["Stored"]);
  });

  it("reads the schema and device stored on the submission", () => {
    const gated = gatedOn({ kind: "deviceType", deviceType: ["mobile"] });
    const stored = (deviceType: string) => ({
      submission: {
        ...submission,
        schemaSnapshot: gated,
        deviceType,
      },
    });

    expect(values(stored("mobile"))).toEqual(["Stored"]);
    expect(values(stored("desktop"))).toEqual([]);
  });

  it("reads the validator results stored on the submission", () => {
    const gated = gatedOn({ kind: "validator", validatorId: 7 });
    const stored = (verdict: boolean) => ({
      schema: gated,
      submission: { ...submission, visibilityValidatorResults: { 7: verdict } },
    });

    expect(values(stored(true))).toEqual(["Stored"]);
    expect(values(stored(false))).toEqual([]);
    expect(values({ ...stored(true), validatorResults: { 7: false } })).toEqual(
      [],
    );
  });

  it("prefers explicit answers over the submission's", () => {
    expect(
      values({ schema, submission, viewId: "v1", answers: { name: "Given" } }),
    ).toEqual(["Given"]);
  });

  it("is empty without a schema", () => {
    expect(values({ submission: null, viewId: "v1" })).toEqual([]);
  });

  it("falls back to the default view for an unknown view id", () => {
    expect(values({ schema, submission, viewId: "missing" })).toEqual([
      "Stored",
    ]);
  });

  it("is empty for a schema without output views", () => {
    expect(
      values({ schema: { ...schema, outputViews: [] }, submission }),
    ).toEqual([]);
  });
});
