import type { FormSchema } from "@alliance/common/forms/form-schema";
import { evaluateVariable } from "@alliance/common/forms/variable-evaluation";
import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { R } from "@alliance/common/result";
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
  deviceType: null,
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

  it("hides answers the member didn't make public", () => {
    const privately = { ...submission, publicAnswers: { name: false } };
    expect(values({ schema, submission: privately })).toEqual([]);
    expect(values({ schema, answers: { name: "Given" } })).toEqual([]);
  });

  it("shows the member their own answers whatever they shared", () => {
    const privately = { ...submission, publicAnswers: { name: false } };
    expect(values({ schema, submission: privately, ownView: true })).toEqual([
      "Stored",
    ]);
    expect(
      values({ schema, answers: { name: "Given" }, ownView: true }),
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

  describe("with a random variable", () => {
    const pick = {
      name: "pick",
      inputs: { input1: { kind: "random" } },
      formula: "input1",
    } as const;
    const picking: FormSchema = {
      ...schema,
      outputViews: [
        {
          type: "default",
          id: "v1",
          blocks: [{ id: "t", type: "display", kind: "text", text: "#{pick}" }],
        },
      ],
      variables: [pick],
    };
    const text = (source: OutputSource) => {
      const [item] = renderHook(() => useOutputItems(source)).result.current;
      return item.type === "display" && item.block.kind === "text"
        ? item.block.text
        : undefined;
    };

    it("shows the pick the submitter saw filling out the form", () => {
      const seen = R.unwrap(
        evaluateVariable(pick, {
          answers: {},
          fields: new Map(),
          randomizationKey: "form:1:user:42",
        }),
      );
      expect(text({ schema: picking, submission, submitterId: 42 })).toBe(seen);
    });

    it("leaves it unresolved without a submitter", () => {
      expect(text({ schema: picking, submission })).toBe("#{pick}");
    });
  });
});
