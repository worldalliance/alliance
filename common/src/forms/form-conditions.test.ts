import type { DisplayBlock } from "./display-blocks";
import {
  collectSourceFormIds,
  conditionHolders,
  forEachCondition,
  memberConditions,
  PlaceKind,
} from "./form-conditions";
import type { AnyField, FormSchema, Page, TextField } from "./form-schema";
import type { Condition } from "./visible-if-formula";

describe("conditionHolders", () => {
  it("yields pages, elements, and list sub-fields in form order", () => {
    const pages: Page[] = [
      {
        id: "p1",
        fields: [
          { id: "intro", type: "display", kind: "text", text: "Hi" },
          {
            id: "kids",
            type: "input",
            kind: "list",
            label: "Kids",
            fields: [
              { id: "name", type: "input", kind: "text", label: "Name" },
            ],
          },
        ],
      },
    ];
    expect(
      [...conditionHolders(pages)].map(({ place, question }) => [
        place,
        question?.id ?? null,
      ]),
    ).toEqual([
      [{ kind: PlaceKind.Page, pageIndex: 0 }, null],
      [{ kind: PlaceKind.Element, pageIndex: 0, index: 0 }, null],
      [{ kind: PlaceKind.Element, pageIndex: 0, index: 1 }, "kids"],
      [
        { kind: PlaceKind.SubField, pageIndex: 0, index: 1, subIndex: 0 },
        "name",
      ],
    ]);
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

describe("memberConditions", () => {
  it("lists each condition that depends on the member once, skipping answer-based ones", () => {
    const city: Condition = { kind: "userHasCity", userHasCity: true };
    const validator: Condition = { kind: "validator", validatorId: 4 };
    const earlierForm: Condition = {
      kind: "hasValue",
      when: "q",
      hasValue: true,
      sourceFormId: 9,
    };
    const thisForm: Condition = { kind: "hasValue", when: "q", hasValue: true };
    const formula = (conditions: Record<string, Condition>) => ({
      formula: Object.keys(conditions).join(" AND "),
      conditions,
    });
    const schema: FormSchema = {
      pages: [
        {
          id: "p1",
          visibleIfFormula: formula({ a: city, b: thisForm }),
          fields: [
            {
              id: "q",
              type: "input",
              kind: "text",
              label: "Q",
              visibleIfFormula: formula({ a: validator, b: city }),
              requiredIfFormula: formula({ a: earlierForm }),
            },
          ],
        },
      ],
      outputViews: [],
    };
    expect(memberConditions(schema)).toEqual([city, validator, earlierForm]);
  });
});
