import type { DisplayBlock } from "./display-blocks";
import {
  type AnyField,
  anyFieldSchema,
  collectSourceFormIds,
  forEachCondition,
  type FormSchema,
  type TextField,
} from "./form-schema";
import type { Condition } from "./visible-if-formula";

const optionField = (
  kind: "radio" | "select" | "multiselect" | "ranking",
  values: string[],
) => ({
  id: "field",
  type: "input",
  kind,
  label: "Field",
  options: values.map((value) => ({ label: value.toUpperCase(), value })),
});

describe("option value uniqueness", () => {
  const kinds = ["radio", "select", "multiselect", "ranking"] as const;

  it.each(kinds)("accepts distinct option values for %s", (kind) => {
    expect(
      anyFieldSchema.safeParse(optionField(kind, ["a", "b"])).success,
    ).toBe(true);
  });

  it.each(kinds)("rejects duplicate option values for %s", (kind) => {
    expect(
      anyFieldSchema.safeParse(optionField(kind, ["a", "b", "a"])).success,
    ).toBe(false);
  });
});

describe("forEachCondition", () => {
  /** A condition tagged with the slot it was hung on, so order is checkable. */
  const marker = (when: string): Condition => ({
    kind: "equals",
    when,
    equals: "yes",
  });

  const textField = (
    id: string,
    overrides: Partial<TextField> = {},
  ): TextField => ({
    id,
    type: "input",
    kind: "text",
    label: id,
    ...overrides,
  });

  const divider = (slot?: string): DisplayBlock => ({
    type: "display",
    kind: "divider",
    visibleIfFormula: slot
      ? { conditions: { c1: marker(slot) }, formula: "c1" }
      : undefined,
  });

  /** Every slot a condition can hang on across an input schema. */
  const kitchenSink: FormSchema = {
    pages: [
      {
        id: "p1",
        visibleIfFormula: {
          conditions: { c1: marker("page-formula") },
          formula: "c1",
        },
        fields: [
          divider("display-formula"),
          textField("f1", {
            visibleIfFormula: {
              conditions: { c1: marker("field-formula") },
              formula: "c1",
            },
            requiredIfFormula: {
              conditions: { c1: marker("field-requiredIf") },
              formula: "c1",
            },
          }),
          {
            id: "l1",
            type: "input",
            kind: "list",
            label: "l1",
            fields: [
              textField("s1", {
                visibleIfFormula: {
                  conditions: { c1: marker("sub-formula") },
                  formula: "c1",
                },
                requiredIfFormula: {
                  conditions: { c1: marker("sub-requiredIf") },
                  formula: "c1",
                },
              }),
            ],
          },
          {
            id: "g1",
            type: "group",
            kind: "group",
            visibleIfFormula: {
              conditions: { c1: marker("group-formula") },
              formula: "c1",
            },
            requiredIfFormula: {
              conditions: { c1: marker("group-requiredIf") },
              formula: "c1",
            },
            fields: [
              textField("g1f", {
                visibleIfFormula: {
                  conditions: { c1: marker("group-child-formula") },
                  formula: "c1",
                },
              }),
            ],
          },
        ],
      },
    ],
    outputViews: [
      { id: "v1", type: "default", blocks: [divider("output-formula")] },
    ],
  };

  const visitedSlots = (schema: FormSchema): string[] => {
    const slots: string[] = [];
    forEachCondition(schema, (condition) => {
      if (condition.kind === "equals") slots.push(condition.when);
    });
    return slots;
  };

  it("visits every condition slot on the input pages", () => {
    expect(visitedSlots(kitchenSink)).toEqual([
      "page-formula",
      "display-formula",
      "field-formula",
      "field-requiredIf",
      "sub-formula",
      "sub-requiredIf",
      "group-formula",
      "group-requiredIf",
      "group-child-formula",
    ]);
  });

  it("does not visit output-view conditions", () => {
    expect(visitedSlots(kitchenSink)).not.toContain("output-formula");
  });

  it("stops early when the visitor returns true", () => {
    const seen: string[] = [];
    const stopped = forEachCondition(kitchenSink, (condition) => {
      if (condition.kind !== "equals") return;
      seen.push(condition.when);
      return condition.when === "field-formula";
    });
    expect(stopped).toBe(true);
    expect(seen).toEqual(["page-formula", "display-formula", "field-formula"]);
  });

  it("reports not-stopped for a full walk", () => {
    expect(forEachCondition(kitchenSink, () => undefined)).toBe(false);
  });

  it("tolerates a schema with no conditions", () => {
    const bare: FormSchema = {
      pages: [{ id: "p1", fields: [textField("f1")] }],
      outputViews: [],
    };
    expect(visitedSlots(bare)).toEqual([]);
    expect(forEachCondition(bare, () => true)).toBe(false);
  });
});

/**
 * A predicate that returns `true` on a match makes `forEachCondition` a
 * short-circuiting `some` — the idiom `schemaNeedsVisibilityContext` relies on.
 */
describe("forEachCondition as a predicate", () => {
  const schemaWith = (field: AnyField): FormSchema => ({
    pages: [{ id: "p1", fields: [field] }],
    outputViews: [],
  });

  const requiredIfField: AnyField = {
    id: "f1",
    type: "input",
    kind: "text",
    label: "f1",
    requiredIfFormula: {
      conditions: { c1: { kind: "userHasCity", userHasCity: true } },
      formula: "c1",
    },
  };

  it("matches a condition reachable only through requiredIfFormula", () => {
    expect(
      forEachCondition(
        schemaWith(requiredIfField),
        (condition) => condition.kind === "userHasCity",
      ),
    ).toBe(true);
  });

  it("is false when nothing matches", () => {
    expect(
      forEachCondition(
        schemaWith(requiredIfField),
        (condition) => condition.kind === "deviceType",
      ),
    ).toBe(false);
  });
});

describe("collectSourceFormIds", () => {
  it("collects ids from visibleIfFormula and requiredIfFormula alike", () => {
    const schema: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "f1",
              type: "input",
              kind: "text",
              label: "f1",
              visibleIfFormula: {
                conditions: {
                  c1: {
                    kind: "hasValue",
                    when: "x",
                    hasValue: true,
                    sourceFormId: 7,
                  },
                },
                formula: "c1",
              },
              requiredIfFormula: {
                conditions: {
                  c1: {
                    kind: "equals",
                    when: "y",
                    equals: "yes",
                    sourceFormId: 9,
                  },
                },
                formula: "c1",
              },
            },
          ],
        },
      ],
      outputViews: [],
    };
    expect(collectSourceFormIds(schema).sort()).toEqual([7, 9]);
  });
});
