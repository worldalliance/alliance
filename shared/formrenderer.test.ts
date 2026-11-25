import type {
  AnyField,
  FormSchema,
  ListField,
  TextField,
} from "@alliance/common/forms/form-schema";
import type { Condition } from "@alliance/common/forms/visible-if-formula";
import {
  findUncompilableFormula,
  findUnknownConditionKind,
  findUnknownFormElementKind,
  findUnknownVariableInputKind,
  getFallbackVisiblePageIndex,
  getNextVisiblePageIndex,
  getPreviousVisiblePageIndex,
  schemaNeedsVisibilityContext,
} from "./formrenderer";

describe("getNextVisiblePageIndex", () => {
  it("returns the first visible index after the current one", () => {
    expect(getNextVisiblePageIndex([0, 2, 5], 0)).toBe(2);
    expect(getNextVisiblePageIndex([0, 2, 5], 3)).toBe(5);
  });

  it("returns null when nothing is visible after the current index", () => {
    expect(getNextVisiblePageIndex([0, 2, 5], 5)).toBeNull();
    expect(getNextVisiblePageIndex([], 0)).toBeNull();
  });
});

describe("getPreviousVisiblePageIndex", () => {
  it("returns the last visible index before the current one", () => {
    expect(getPreviousVisiblePageIndex([0, 2, 5], 5)).toBe(2);
    expect(getPreviousVisiblePageIndex([0, 2, 5], 3)).toBe(2);
  });

  it("returns null when nothing is visible before the current index", () => {
    expect(getPreviousVisiblePageIndex([0, 2, 5], 0)).toBeNull();
    expect(getPreviousVisiblePageIndex([], 0)).toBeNull();
  });
});

describe("getFallbackVisiblePageIndex", () => {
  it("returns null when the current page is still visible", () => {
    expect(getFallbackVisiblePageIndex([0, 2, 5], 2)).toBeNull();
  });

  it("returns null when no page is visible", () => {
    expect(getFallbackVisiblePageIndex([], 3)).toBeNull();
  });

  it("prefers the nearest visible page forward", () => {
    expect(getFallbackVisiblePageIndex([0, 2, 5], 1)).toBe(2);
  });

  it("falls back to the closest visible page before when nothing is forward", () => {
    expect(getFallbackVisiblePageIndex([0, 2, 5], 6)).toBe(5);
  });
});

describe("schemaNeedsVisibilityContext", () => {
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

  const listField = (id: string, fields: ListField["fields"]): ListField => ({
    id,
    type: "input",
    kind: "list",
    label: id,
    fields,
  });

  const schemaWith = (fields: AnyField[]): FormSchema => ({
    pages: [{ id: "p1", fields }],
    outputViews: [],
  });

  const accountDerived: Condition = {
    kind: "completedActionCount",
    atLeast: 1,
  };
  const answerDerived: Condition = {
    kind: "hasValue",
    when: "f1",
    hasValue: true,
  };
  const asFormula = (condition: Condition) => ({
    conditions: { c1: condition },
    formula: "c1",
  });

  it("is false for a schema with no account-derived condition", () => {
    expect(
      schemaNeedsVisibilityContext(
        schemaWith([
          textField("f1", { requiredIfFormula: asFormula(answerDerived) }),
        ]),
      ),
    ).toBe(false);
  });

  it("is true for an account-derived condition in visibleIfFormula", () => {
    expect(
      schemaNeedsVisibilityContext(
        schemaWith([
          textField("f1", {
            visibleIfFormula: {
              conditions: { c1: accountDerived },
              formula: "c1",
            },
          }),
        ]),
      ),
    ).toBe(true);
  });

  it("is true for an account-derived condition in requiredIfFormula", () => {
    expect(
      schemaNeedsVisibilityContext(
        schemaWith([
          textField("f1", { requiredIfFormula: asFormula(accountDerived) }),
        ]),
      ),
    ).toBe(true);
  });

  it("is true for an account-derived requiredIfFormula on a list sub-field", () => {
    expect(
      schemaNeedsVisibilityContext(
        schemaWith([
          listField("l1", [
            textField("s1", { requiredIfFormula: asFormula(accountDerived) }),
          ]),
        ]),
      ),
    ).toBe(true);
  });
});

describe("findUnknownConditionKind", () => {
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

  /** A schema authored by a newer build, as it arrives off the wire. */
  const futureCondition = (): Condition =>
    JSON.parse('{ "kind": "somethingAddedLater" }');

  const asFormula = (condition: Condition) => ({
    conditions: { c1: condition },
    formula: "c1",
  });

  const schemaWith = (overrides: Partial<FormSchema>): FormSchema => ({
    pages: [{ id: "p1", fields: [textField("f1")] }],
    outputViews: [],
    ...overrides,
  });

  it("is null when every kind is known", () => {
    expect(
      findUnknownConditionKind(
        schemaWith({
          pages: [
            {
              id: "p1",
              fields: [
                textField("f1", {
                  visibleIfFormula: asFormula({
                    kind: "completedActionCount",
                    atLeast: 1,
                  }),
                }),
              ],
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("finds an unknown kind on a page, a field, and a requiredIfFormula", () => {
    const onPage = schemaWith({
      pages: [
        {
          id: "p1",
          fields: [textField("f1")],
          visibleIfFormula: asFormula(futureCondition()),
        },
      ],
    });
    const onField = schemaWith({
      pages: [
        {
          id: "p1",
          fields: [
            textField("f1", { visibleIfFormula: asFormula(futureCondition()) }),
          ],
        },
      ],
    });
    const onRequiredIf = schemaWith({
      pages: [
        {
          id: "p1",
          fields: [
            textField("f1", {
              requiredIfFormula: asFormula(futureCondition()),
            }),
          ],
        },
      ],
    });
    for (const schema of [onPage, onField, onRequiredIf]) {
      expect(findUnknownConditionKind(schema)).toBe("somethingAddedLater");
    }
  });

  it("finds an unknown kind on a list sub-field", () => {
    expect(
      findUnknownConditionKind(
        schemaWith({
          pages: [
            {
              id: "p1",
              fields: [
                {
                  id: "l1",
                  type: "input",
                  kind: "list",
                  label: "l1",
                  fields: [
                    textField("s1", {
                      requiredIfFormula: asFormula(futureCondition()),
                    }),
                  ],
                },
              ],
            },
          ],
        }),
      ),
    ).toBe("somethingAddedLater");
  });

  it("finds an unknown kind on an output-view block", () => {
    expect(
      findUnknownConditionKind(
        schemaWith({
          outputViews: [
            {
              id: "v1",
              type: "default",
              blocks: [
                {
                  type: "display",
                  kind: "divider",
                  visibleIfFormula: asFormula(futureCondition()),
                },
              ],
            },
          ],
        }),
      ),
    ).toBe("somethingAddedLater");
  });
});

describe("findUnknownFormElementKind", () => {
  it("finds an unknown kind inside a list", () => {
    const schema: FormSchema = JSON.parse(
      '{ "pages": [{ "id": "p1", "fields": [{ "id": "l1", "type": "input", "kind": "list", "label": "Items", "fields": [{ "id": "s1", "type": "input", "kind": "hologram", "label": "S" }] }] }], "outputViews": [] }',
    );
    expect(findUnknownFormElementKind(schema)).toBe("hologram");
  });
});

describe("findUnknownVariableInputKind", () => {
  const schemaWith = (overrides: Partial<FormSchema>): FormSchema => ({
    pages: [{ id: "p1", fields: [] }],
    outputViews: [],
    ...overrides,
  });

  it("is null when every input kind is known", () => {
    expect(
      findUnknownVariableInputKind(
        schemaWith({
          variables: [
            { name: "n", inputs: { input1: { kind: "random" } }, formula: "1" },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("finds an unknown kind in a variable and in an options formula", () => {
    const future = JSON.parse('{ "input1": { "kind": "telepathy" } }');
    expect(
      findUnknownVariableInputKind(
        schemaWith({
          variables: [{ name: "n", inputs: future, formula: "input1" }],
        }),
      ),
    ).toBe("telepathy");
    expect(
      findUnknownVariableInputKind(
        schemaWith({
          pages: [
            {
              id: "p1",
              fields: [
                {
                  id: "s1",
                  type: "input",
                  kind: "select",
                  label: "Pick",
                  options: [],
                  optionsFormula: { inputs: future, formula: "input1" },
                },
              ],
            },
          ],
        }),
      ),
    ).toBe("telepathy");
  });
});

describe("findUncompilableFormula", () => {
  const withVariable = (formula: string): FormSchema => ({
    pages: [{ id: "p1", fields: [] }],
    outputViews: [],
    variables: [{ name: "n", inputs: {}, formula }],
  });

  it("is null when every formula compiles", () => {
    expect(findUncompilableFormula(withVariable("1 + 1"))).toBeNull();
  });

  it("describes a formula this build can't compile", () => {
    expect(findUncompilableFormula(withVariable("Math.sumPrecise(1)"))).toMatch(
      /^formula syntax \(/,
    );
  });
});
