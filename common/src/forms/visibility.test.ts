import type { FieldGroup, FormValue, Page, TextField } from "./form-schema";
import {
  emptyUserPropertyPresence,
  UserValueProperty,
} from "./user-properties";
import {
  isElementCurrentlyVisible,
  isFieldConditionallyRequired,
  isPageCurrentlyVisible,
  isVisibleInSavedResponse,
  listRowData,
  replaysFromSavedResponse,
  stripHiddenAnswers,
  stripHiddenListCells,
  visibleListSubFields,
} from "./visibility";
import type { Condition, VisibleIfFormula } from "./visible-if-formula";

const formula = (conditions: Record<string, Condition>): VisibleIfFormula => ({
  conditions,
  formula: Object.keys(conditions)[0] ?? "",
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

const page = (id: string, overrides: Partial<Page> = {}): Page => ({
  id,
  fields: [],
  ...overrides,
});

const extras = { deviceType: "desktop" as const };

describe("isPageCurrentlyVisible", () => {
  const conditionalPage = page("p2", {
    fields: [textField("f2")],
    visibleIfFormula: formula({
      c1: { kind: "equals", when: "f1", equals: "yes" },
    }),
  });

  it("is visible without a formula", () => {
    expect(isPageCurrentlyVisible(page("p1"), {}, extras)).toBe(true);
  });

  it("is visible with an empty formula", () => {
    expect(
      isPageCurrentlyVisible(
        page("p1", { visibleIfFormula: formula({}) }),
        {},
        extras,
      ),
    ).toBe(true);
  });

  it("evaluates the formula against answers", () => {
    expect(isPageCurrentlyVisible(conditionalPage, { f1: "yes" }, extras)).toBe(
      true,
    );
    expect(isPageCurrentlyVisible(conditionalPage, { f1: "no" }, extras)).toBe(
      false,
    );
  });

  it("stays hidden in readOnly when the page has no answers", () => {
    expect(
      isPageCurrentlyVisible(
        conditionalPage,
        { f1: "no" },
        { ...extras, readOnly: true },
      ),
    ).toBe(false);
  });

  it("stays visible in readOnly when a field on the page was answered", () => {
    // Conditions don't always replay when reviewing a completed response
    // (e.g. validator results missing from older submissions), so an answered
    // page must never be hidden.
    expect(
      isPageCurrentlyVisible(
        conditionalPage,
        { f1: "no", f2: "answered" },
        { ...extras, readOnly: true },
      ),
    ).toBe(true);
  });
});

describe("firstContractSigned condition", () => {
  const signedPage = (
    comparison: "before" | "onOrAfter",
    date = "2026-01-01T00:00:00.000Z",
  ): Page =>
    page("p1", {
      fields: [textField("f1")],
      visibleIfFormula: formula({
        c1: { kind: "firstContractSigned", comparison, date },
      }),
    });

  it("compares the first signing date against the threshold", () => {
    const early = {
      ...extras,
      firstContractSignedAt: "2025-06-15T12:00:00.000Z",
    };
    const late = {
      ...extras,
      firstContractSignedAt: "2026-03-01T00:00:00.000Z",
    };

    expect(isPageCurrentlyVisible(signedPage("before"), {}, early)).toBe(true);
    expect(isPageCurrentlyVisible(signedPage("before"), {}, late)).toBe(false);
    expect(isPageCurrentlyVisible(signedPage("onOrAfter"), {}, early)).toBe(
      false,
    );
    expect(isPageCurrentlyVisible(signedPage("onOrAfter"), {}, late)).toBe(
      true,
    );
  });

  it("treats a signing at exactly the threshold as onOrAfter", () => {
    const atThreshold = {
      ...extras,
      firstContractSignedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(
      isPageCurrentlyVisible(signedPage("onOrAfter"), {}, atThreshold),
    ).toBe(true);
    expect(isPageCurrentlyVisible(signedPage("before"), {}, atThreshold)).toBe(
      false,
    );
  });

  it("fails both comparisons when the user has never signed", () => {
    expect(isPageCurrentlyVisible(signedPage("before"), {}, extras)).toBe(
      false,
    );
    expect(isPageCurrentlyVisible(signedPage("onOrAfter"), {}, extras)).toBe(
      false,
    );
    const explicitNull = { ...extras, firstContractSignedAt: null };
    expect(isPageCurrentlyVisible(signedPage("before"), {}, explicitNull)).toBe(
      false,
    );
  });

  it("fails when either datetime is unparseable", () => {
    const garbageSignedAt = { ...extras, firstContractSignedAt: "not-a-date" };
    expect(
      isPageCurrentlyVisible(signedPage("before"), {}, garbageSignedAt),
    ).toBe(false);
    const valid = {
      ...extras,
      firstContractSignedAt: "2025-06-15T12:00:00.000Z",
    };
    expect(
      isPageCurrentlyVisible(signedPage("before", "not-a-date"), {}, valid),
    ).toBe(false);
  });
});

describe("a condition kind this build doesn't know", () => {
  /**
   * Parsed rather than written as a literal: this is what a schema authored by
   * a newer build looks like arriving off the wire, which is the only way an
   * unknown kind reaches these functions.
   */
  const futureCondition = (): Condition =>
    JSON.parse('{ "kind": "somethingAddedLater", "atLeast": 1 }');

  it("evaluates as not met instead of throwing", () => {
    const futurePage = page("p1", {
      fields: [textField("f1")],
      visibleIfFormula: formula({ c1: futureCondition() }),
    });
    expect(() => isPageCurrentlyVisible(futurePage, {}, extras)).not.toThrow();
    expect(isPageCurrentlyVisible(futurePage, {}, extras)).toBe(false);
  });

  it("does not throw while resolving requiredness", () => {
    const field = textField("f1", {
      required: true,
      requiredIfFormula: formula({ c1: futureCondition() }),
    });
    expect(isFieldConditionallyRequired(field, {}, extras)).toBe(false);
  });

  it("leaves the rest of the formula working", () => {
    // AND with an unknown operand fails; OR still passes on the known half.
    const conditions = {
      c1: futureCondition(),
      c2: { kind: "equals", when: "f1", equals: "yes" } satisfies Condition,
    };
    const orPage = page("p1", {
      fields: [textField("f1")],
      visibleIfFormula: {
        conditions,
        formula: { op: "OR", left: "c1", right: "c2" },
      },
    });
    expect(isPageCurrentlyVisible(orPage, { f1: "yes" }, extras)).toBe(true);
    expect(isPageCurrentlyVisible(orPage, { f1: "no" }, extras)).toBe(false);
  });
});

describe("completedActionCount condition", () => {
  const completedPage = (atLeast: number): Page =>
    page("p1", {
      fields: [textField("f1")],
      visibleIfFormula: formula({
        c1: { kind: "completedActionCount", atLeast },
      }),
    });

  it("is visible once the user reaches the threshold", () => {
    const three = { ...extras, completedActionCount: 3 };
    expect(isPageCurrentlyVisible(completedPage(2), {}, three)).toBe(true);
    expect(isPageCurrentlyVisible(completedPage(3), {}, three)).toBe(true);
    expect(isPageCurrentlyVisible(completedPage(4), {}, three)).toBe(false);
  });

  it("treats a missing count as zero", () => {
    expect(isPageCurrentlyVisible(completedPage(1), {}, extras)).toBe(false);
    expect(isPageCurrentlyVisible(completedPage(0), {}, extras)).toBe(true);
  });

  it("supports 'fewer than' via a negated formula", () => {
    const fewerThanTwo: Page = page("p1", {
      fields: [textField("f1")],
      visibleIfFormula: {
        conditions: { c1: { kind: "completedActionCount", atLeast: 2 } },
        formula: { op: "NOT", operand: "c1" },
      },
    });
    expect(
      isPageCurrentlyVisible(
        fewerThanTwo,
        {},
        { ...extras, completedActionCount: 1 },
      ),
    ).toBe(true);
    expect(
      isPageCurrentlyVisible(
        fewerThanTwo,
        {},
        { ...extras, completedActionCount: 2 },
      ),
    ).toBe(false);
  });
});

describe("isFieldConditionallyRequired", () => {
  it("falls back to the static flag without a requiredIfFormula", () => {
    expect(isFieldConditionallyRequired(textField("f1"), {}, extras)).toBe(
      false,
    );
    expect(
      isFieldConditionallyRequired(
        textField("f1", { required: true }),
        {},
        extras,
      ),
    ).toBe(true);
  });

  it("evaluates a single-condition formula against the answers", () => {
    const field = textField("f2", {
      requiredIfFormula: formula({
        c1: { kind: "equals", when: "f1", equals: "yes" },
      }),
    });
    expect(isFieldConditionallyRequired(field, { f1: "yes" }, extras)).toBe(
      true,
    );
    expect(isFieldConditionallyRequired(field, { f1: "no" }, extras)).toBe(
      false,
    );
  });

  it("evaluates against the account-derived extras", () => {
    const field = textField("f1", {
      requiredIfFormula: formula({
        c1: { kind: "completedActionCount", atLeast: 2 },
      }),
    });
    expect(
      isFieldConditionallyRequired(
        field,
        {},
        {
          ...extras,
          completedActionCount: 2,
        },
      ),
    ).toBe(true);
    expect(isFieldConditionallyRequired(field, {}, extras)).toBe(false);
  });

  it("combines conditions with AND/OR/NOT like visibility does", () => {
    const field = textField("f3", {
      requiredIfFormula: {
        conditions: {
          c1: { kind: "equals", when: "f1", equals: "yes" },
          c2: { kind: "completedActionCount", atLeast: 2 },
        },
        formula: { op: "AND", left: "c1", right: "c2" },
      },
    });
    const twoDone = { ...extras, completedActionCount: 2 };
    expect(isFieldConditionallyRequired(field, { f1: "yes" }, twoDone)).toBe(
      true,
    );
    // Each half alone is not enough.
    expect(isFieldConditionallyRequired(field, { f1: "no" }, twoDone)).toBe(
      false,
    );
    expect(isFieldConditionallyRequired(field, { f1: "yes" }, extras)).toBe(
      false,
    );
  });

  it("overrides the static flag in both directions", () => {
    const requiredButNotYet = textField("f2", {
      required: true,
      requiredIfFormula: formula({
        c1: { kind: "equals", when: "f1", equals: "yes" },
      }),
    });
    expect(
      isFieldConditionallyRequired(requiredButNotYet, { f1: "no" }, extras),
    ).toBe(false);
    expect(
      isFieldConditionallyRequired(requiredButNotYet, { f1: "yes" }, extras),
    ).toBe(true);
  });

  it("ignores an empty formula and falls back to the static flag", () => {
    const field = textField("f1", {
      required: true,
      requiredIfFormula: { conditions: {}, formula: "" },
    });
    expect(isFieldConditionallyRequired(field, {}, extras)).toBe(true);
  });
});

describe("listRowData", () => {
  it("puts the row's cells over the form's answers", () => {
    expect(
      listRowData({ data: { gate: "yes", other: 1 }, row: { gate: "no" } }),
    ).toEqual({ gate: "no", other: 1 });
  });
});

describe("visibleListSubFields", () => {
  const gated = textField("note", {
    visibleIfFormula: formula({
      c1: { kind: "equals", when: "gate", equals: "yes" },
    }),
  });
  const subFields = [textField("gate"), gated];

  it("reads a form answer the row's cells don't cover", () => {
    expect(
      visibleListSubFields({
        subFields,
        data: { gate: "yes" },
        row: {},
        extras,
      }),
    ).toEqual(subFields);
    expect(
      visibleListSubFields({
        subFields,
        data: { gate: "no" },
        row: {},
        extras,
      }),
    ).toEqual([subFields[0]]);
  });

  it("keeps a sub-field the row's cells reveal", () => {
    expect(
      visibleListSubFields({
        subFields,
        data: { gate: "no" },
        row: { gate: "yes" },
        extras,
      }),
    ).toEqual(subFields);
  });

  it("drops a sub-field the row's cells hide", () => {
    expect(
      visibleListSubFields({
        subFields,
        data: { gate: "yes" },
        row: { gate: "no" },
        extras,
      }),
    ).toEqual([subFields[0]]);
  });

  it("reads the row's cells with no form answers at all", () => {
    expect(
      visibleListSubFields({
        subFields,
        data: {},
        row: { gate: "no" },
        extras,
      }),
    ).toEqual([subFields[0]]);
  });
});

describe("stripHiddenAnswers", () => {
  const equalsYes = (when: string): Condition => ({
    kind: "equals",
    when,
    equals: "yes",
  });

  it("returns the same object when every answered field is visible", () => {
    const pages = [page("p1", { fields: [textField("f1"), textField("f2")] })];
    const answers = { f1: "yes", f2: "hello" };
    expect(stripHiddenAnswers(pages, answers, extras)).toBe(answers);
  });

  it("strips the answer of a field hidden by its own formula", () => {
    const pages = [
      page("p1", {
        fields: [
          textField("f1"),
          textField("f2", {
            visibleIfFormula: formula({ c1: equalsYes("f1") }),
          }),
        ],
      }),
    ];
    expect(
      stripHiddenAnswers(pages, { f1: "no", f2: "stale" }, extras),
    ).toEqual({ f1: "no" });
  });

  it("strips all answers on a hidden page", () => {
    const pages = [
      page("p1", { fields: [textField("f1")] }),
      page("p2", {
        fields: [textField("f2"), textField("f3")],
        visibleIfFormula: formula({ c1: equalsYes("f1") }),
      }),
    ];
    expect(
      stripHiddenAnswers(pages, { f1: "no", f2: "stale", f3: "stale" }, extras),
    ).toEqual({ f1: "no" });
  });

  it("cascades: a stripped answer hides pages that depended on it", () => {
    // f1 = "no" hides page 2, so f2's stale "yes" must not keep page 3
    // visible; both f2 and f3 get stripped.
    const pages = [
      page("p1", { fields: [textField("f1")] }),
      page("p2", {
        fields: [textField("f2")],
        visibleIfFormula: formula({ c1: equalsYes("f1") }),
      }),
      page("p3", {
        fields: [textField("f3")],
        visibleIfFormula: formula({ c1: equalsYes("f2") }),
      }),
    ];
    expect(
      stripHiddenAnswers(pages, { f1: "no", f2: "yes", f3: "kept?" }, extras),
    ).toEqual({ f1: "no" });
  });

  it("leaves keys that belong to no question field untouched", () => {
    const pages = [page("p1", { fields: [textField("f1")] })];
    expect(
      stripHiddenAnswers(pages, { f1: "yes", legacy: "keep" }, extras),
    ).toEqual({ f1: "yes", legacy: "keep" });
  });

  it("does not strip answered fields in readOnly", () => {
    // Mirrors the readOnly fallbacks: reviewing a completed response must
    // never drop answers, even when conditions no longer replay as true.
    const pages = [
      page("p1", { fields: [textField("f1")] }),
      page("p2", {
        fields: [textField("f2")],
        visibleIfFormula: formula({ c1: equalsYes("f1") }),
      }),
    ];
    const answers = { f1: "no", f2: "answered" };
    expect(
      stripHiddenAnswers(pages, answers, { ...extras, readOnly: true }),
    ).toBe(answers);
  });
});

describe("stripHiddenAnswers in list rows", () => {
  const equalsYes = (when: string): Condition => ({
    kind: "equals",
    when,
    equals: "yes",
  });

  const listPage = (fields: TextField[]) => [
    page("p1", {
      fields: [
        textField("gate"),
        { id: "people", type: "input", kind: "list", label: "People", fields },
      ],
    }),
  ];

  it("strips a cell hidden for its row and keeps the rest of the row", () => {
    const pages = listPage([
      textField("name"),
      textField("note", {
        visibleIfFormula: formula({ c1: equalsYes("name") }),
      }),
    ]);
    expect(
      stripHiddenAnswers(
        pages,
        {
          people: [
            { name: "yes", note: "shown", __cardId: "c0" },
            { name: "no", note: "stale", __cardId: "c1" },
          ],
        },
        extras,
      ),
    ).toEqual({
      people: [
        { name: "yes", note: "shown", __cardId: "c0" },
        { name: "no", __cardId: "c1" },
      ],
    });
  });

  it("reads the form's answers under the row's cells", () => {
    const pages = listPage([
      textField("note", {
        visibleIfFormula: formula({ c1: equalsYes("gate") }),
      }),
    ]);
    expect(
      stripHiddenAnswers(
        pages,
        { gate: "no", people: [{ note: "stale" }] },
        extras,
      ),
    ).toEqual({ gate: "no", people: [{}] });
  });

  it("hides a cell whose chain of sibling conditions starts at a hidden cell", () => {
    const pages = listPage([
      textField("a"),
      textField("b", { visibleIfFormula: formula({ c1: equalsYes("a") }) }),
      textField("c", { visibleIfFormula: formula({ c1: equalsYes("b") }) }),
    ]);
    expect(
      stripHiddenAnswers(
        pages,
        { people: [{ a: "no", b: "yes", c: "stale" }] },
        extras,
      ),
    ).toEqual({ people: [{ a: "no" }] });
  });

  it("returns the same object when every answered cell is visible", () => {
    const pages = listPage([
      textField("name"),
      textField("note", {
        visibleIfFormula: formula({ c1: equalsYes("name") }),
      }),
    ]);
    const answers: Record<string, FormValue> = {
      people: [{ name: "yes", note: "shown" }, { name: "no" }],
    };
    expect(stripHiddenAnswers(pages, answers, extras)).toBe(answers);
  });

  it("keeps a cell that a negated condition on a hidden sibling reveals", () => {
    const pages = listPage([
      textField("a"),
      textField("b", { visibleIfFormula: formula({ c1: equalsYes("a") }) }),
      textField("c", {
        visibleIfFormula: {
          conditions: { c1: equalsYes("b") },
          formula: { op: "NOT", operand: "c1" },
        },
      }),
    ]);
    expect(
      stripHiddenAnswers(
        pages,
        {
          people: [
            { a: "yes", b: "yes" },
            { a: "no", b: "yes", c: "shown" },
          ],
        },
        extras,
      ),
    ).toEqual({
      people: [
        { a: "yes", b: "yes" },
        { a: "no", c: "shown" },
      ],
    });
  });

  it("does not strip answered cells in readOnly", () => {
    const pages = listPage([
      textField("name"),
      textField("note", {
        visibleIfFormula: formula({ c1: equalsYes("name") }),
      }),
    ]);
    const answers = { people: [{ name: "no", note: "answered" }] };
    expect(
      stripHiddenAnswers(pages, answers, { ...extras, readOnly: true }),
    ).toBe(answers);
  });
});

describe("stripHiddenListCells", () => {
  const pages = [
    page("p1", {
      fields: [
        textField("gate"),
        {
          id: "people",
          type: "input",
          kind: "list",
          label: "People",
          fields: [
            textField("note", {
              visibleIfFormula: formula({
                c1: { kind: "equals", when: "gate", equals: "yes" },
              }),
            }),
            textField("city", {
              visibleIfFormula: formula({
                c1: { kind: "userHasCity", userHasCity: true },
              }),
            }),
          ],
        },
      ],
    }),
  ];
  const answers: Record<string, FormValue> = {
    gate: "no",
    people: [{ note: "stale", city: "stale" }],
  };

  it("leaves a sub-field the caller says it can't judge", () => {
    expect(
      stripHiddenListCells({
        pages,
        answers,
        extras,
        canJudge: (subField) => subField.id !== "city",
      }),
    ).toEqual({ gate: "no", people: [{ city: "stale" }] });
  });

  it("judges every sub-field without a rule saying otherwise", () => {
    expect(stripHiddenListCells({ pages, answers, extras })).toEqual({
      gate: "no",
      people: [{}],
    });
  });

  it("returns the same answers when the caller can judge nothing", () => {
    expect(
      stripHiddenListCells({ pages, answers, extras, canJudge: () => false }),
    ).toBe(answers);
  });
});

describe("replaysFromSavedResponse", () => {
  const replays = (
    conditions: Record<string, Condition>,
    response: Partial<Parameters<typeof replaysFromSavedResponse>[0]> = {},
  ) =>
    replaysFromSavedResponse({
      element: textField("sub", { visibleIfFormula: formula(conditions) }),
      deviceType: "desktop",
      visibilityValidatorResults: {},
      fieldLookup: new Map(),
      groupByFieldId: new Map(),
      ...response,
    });

  it("replays a condition on the response's own answers", () => {
    expect(
      replays({ c1: { kind: "equals", when: "gate", equals: "yes" } }),
    ).toBe(true);
  });

  it("refuses a condition on another form's answers", () => {
    expect(
      replays({
        c1: { kind: "equals", when: "gate", equals: "yes", sourceFormId: 7 },
      }),
    ).toBe(false);
  });

  it("refuses a condition on the respondent's account", () => {
    expect(replays({ c1: { kind: "userHasCity", userHasCity: true } })).toBe(
      false,
    );
  });

  it("replays a validator condition whose verdict the response recorded", () => {
    expect(
      replays(
        { c1: { kind: "validator", validatorId: 7 } },
        { visibilityValidatorResults: { 7: false } },
      ),
    ).toBe(true);
  });

  it("refuses a validator condition whose verdict the response is missing", () => {
    expect(replays({ c1: { kind: "validator", validatorId: 7 } })).toBe(false);
  });

  it("refuses a device condition when the response recorded no device", () => {
    expect(
      replays(
        { c1: { kind: "deviceType", deviceType: ["mobile"] } },
        { deviceType: undefined },
      ),
    ).toBe(false);
  });

  it("refuses a formula the moment one condition doesn't replay", () => {
    expect(
      replays({
        c1: { kind: "equals", when: "gate", equals: "yes" },
        c2: { kind: "validator", validatorId: 7 },
      }),
    ).toBe(false);
  });

  it("replays a sub-field with no formula at all", () => {
    expect(replays({})).toBe(true);
  });

  const onGate = {
    c1: { kind: "equals", when: "gate", equals: "yes" },
  } as const;
  const lookupWithGate = (gate: TextField) => new Map([["gate", gate]]);

  it("refuses a condition on a field whose own visibility doesn't replay", () => {
    const gate = textField("gate", {
      visibleIfFormula: formula({
        c1: { kind: "deviceType", deviceType: ["mobile"] },
      }),
    });
    expect(
      replays(onGate, {
        deviceType: undefined,
        fieldLookup: lookupWithGate(gate),
      }),
    ).toBe(false);
  });

  it("replays a condition on a field whose own visibility replays", () => {
    const gate = textField("gate", {
      visibleIfFormula: formula({
        c1: { kind: "hasValue", when: "other", hasValue: true },
      }),
    });
    expect(replays(onGate, { fieldLookup: lookupWithGate(gate) })).toBe(true);
  });

  it("refuses a field whose group doesn't replay", () => {
    const group: FieldGroup = {
      id: "g1",
      type: "group",
      kind: "group",
      fields: [],
      visibleIfFormula: formula({
        c1: { kind: "userHasCity", userHasCity: true },
      }),
    };
    expect(replays({}, { groupByFieldId: new Map([["sub", group]]) })).toBe(
      false,
    );
  });

  it("replays fields whose conditions reference each other", () => {
    const gate = textField("gate", {
      visibleIfFormula: formula({
        c1: { kind: "equals", when: "sub", equals: "yes" },
      }),
    });
    const sub = textField("sub", { visibleIfFormula: formula(onGate) });
    expect(
      replays(onGate, {
        fieldLookup: new Map([
          ["gate", gate],
          ["sub", sub],
        ]),
      }),
    ).toBe(true);
  });
});

describe("isVisibleInSavedResponse", () => {
  const gateIsYes = { kind: "equals", when: "gate", equals: "yes" } as const;
  const hasCity = { kind: "userHasCity", userHasCity: true } as const;
  const visible = (
    visibleIfFormula: VisibleIfFormula,
    response: Partial<Parameters<typeof isVisibleInSavedResponse>[0]> = {},
  ) =>
    isVisibleInSavedResponse({
      element: textField("sub", { visibleIfFormula }),
      data: { gate: "no" },
      deviceType: "desktop",
      visibilityValidatorResults: {},
      fieldLookup: new Map(),
      groupByFieldId: new Map(),
      ...response,
    });

  it("hides an element its replayable conditions rule out on their own", () => {
    expect(
      visible({
        conditions: { c1: gateIsYes, c2: hasCity },
        formula: { op: "AND", left: "c1", right: "c2" },
      }),
    ).toBe(false);
  });

  it("shows an element a condition it can't replay could have shown", () => {
    expect(
      visible({
        conditions: { c1: gateIsYes, c2: hasCity },
        formula: { op: "OR", left: "c1", right: "c2" },
      }),
    ).toBe(true);
  });

  it("shows an element whose only condition can't be replayed", () => {
    expect(
      visible({
        conditions: { c1: { kind: "validator", validatorId: 7 } },
        formula: { op: "NOT", operand: "c1" },
      }),
    ).toBe(true);
  });

  describe("with a condition on a field whose own visibility can't be replayed", () => {
    const gatedOnCity = new Map([
      [
        "gate",
        textField("gate", {
          visibleIfFormula: { conditions: { c1: hasCity }, formula: "c1" },
        }),
      ],
    ]);

    it("hides an element the field's answer rules out whether or not the field showed", () => {
      expect(
        visible(
          { conditions: { c1: gateIsYes }, formula: "c1" },
          { fieldLookup: gatedOnCity },
        ),
      ).toBe(false);
    });

    it("shows an element the field's answer rules out only if the field showed", () => {
      expect(
        visible(
          {
            conditions: {
              c1: { kind: "hasValue", when: "gate", hasValue: false },
            },
            formula: "c1",
          },
          { fieldLookup: gatedOnCity },
        ),
      ).toBe(true);
    });
  });

  it("reads a device the response didn't record as unknown", () => {
    expect(
      visible(
        {
          conditions: { c1: { kind: "deviceType", deviceType: ["mobile"] } },
          formula: "c1",
        },
        { deviceType: undefined },
      ),
    ).toBe(true);
  });
});

describe("field groups", () => {
  const grouped = (
    overrides: Partial<FieldGroup> = {},
    child: TextField = textField("child"),
  ): FieldGroup => ({
    id: "g1",
    type: "group",
    kind: "group",
    fields: [child],
    ...overrides,
  });

  it("hides a child when the group formula is false", () => {
    const group = grouped({
      visibleIfFormula: formula({
        c1: { kind: "equals", when: "gate", equals: "yes" },
      }),
    });
    const groupByFieldId = new Map([["child", group]]);
    expect(
      isElementCurrentlyVisible(
        group.fields[0],
        { gate: "no" },
        {
          ...extras,
          groupByFieldId,
        },
      ),
    ).toBe(false);
    expect(
      isElementCurrentlyVisible(
        group.fields[0],
        { gate: "yes" },
        {
          ...extras,
          groupByFieldId,
        },
      ),
    ).toBe(true);
  });

  it("hides a child when either the group or the child formula is false", () => {
    const child = textField("child", {
      visibleIfFormula: formula({
        c1: { kind: "equals", when: "inner", equals: "yes" },
      }),
    });
    const group = grouped(
      {
        visibleIfFormula: formula({
          c1: { kind: "equals", when: "gate", equals: "yes" },
        }),
      },
      child,
    );
    const groupByFieldId = new Map([["child", group]]);
    const ctx = { ...extras, groupByFieldId };
    expect(
      isElementCurrentlyVisible(child, { gate: "yes", inner: "yes" }, ctx),
    ).toBe(true);
    expect(
      isElementCurrentlyVisible(child, { gate: "yes", inner: "no" }, ctx),
    ).toBe(false);
    expect(
      isElementCurrentlyVisible(child, { gate: "no", inner: "yes" }, ctx),
    ).toBe(false);
  });

  it("makes a child required when the group is required", () => {
    const group = grouped({ required: true });
    const child = textField("child");
    const ctx = { ...extras, groupByFieldId: new Map([["child", group]]) };
    expect(isFieldConditionallyRequired(child, {}, extras)).toBe(false);
    expect(isFieldConditionallyRequired(child, {}, ctx)).toBe(true);
  });

  it("keeps a child required when either the group or the child is", () => {
    const group = grouped({ required: true });
    const child = textField("child", { required: true });
    const ctx = { ...extras, groupByFieldId: new Map([["child", group]]) };
    expect(isFieldConditionallyRequired(child, {}, ctx)).toBe(true);
    expect(
      isFieldConditionallyRequired(
        textField("child", { required: true }),
        {},
        extras,
      ),
    ).toBe(true);
  });

  it("strips answers inside a hidden group", () => {
    const group = grouped({
      visibleIfFormula: formula({
        c1: { kind: "equals", when: "gate", equals: "yes" },
      }),
    });
    const pages = [page("p1", { fields: [textField("gate"), group] })];
    expect(
      stripHiddenAnswers(pages, { gate: "no", child: "stale" }, extras),
    ).toEqual({ gate: "no" });
    expect(
      stripHiddenAnswers(pages, { gate: "yes", child: "kept" }, extras),
    ).toEqual({ gate: "yes", child: "kept" });
  });
});

describe("userPropertyHasValue", () => {
  const gated = page("p1", {
    fields: [textField("f1")],
    visibleIfFormula: formula({
      c1: {
        kind: "userPropertyHasValue",
        property: UserValueProperty.PhoneNumber,
        hasValue: true,
      },
    }),
  });

  it("is true when the named property is present", () => {
    expect(
      isPageCurrentlyVisible(
        gated,
        {},
        {
          ...extras,
          userPropertyHasValue: {
            ...emptyUserPropertyPresence(),
            [UserValueProperty.PhoneNumber]: true,
          },
        },
      ),
    ).toBe(true);
  });

  it("is false when the property is missing, including the guest default", () => {
    expect(isPageCurrentlyVisible(gated, {}, extras)).toBe(false);
  });

  it("inverts when hasValue is false", () => {
    const absent = page("p1", {
      fields: [textField("f1")],
      visibleIfFormula: formula({
        c1: {
          kind: "userPropertyHasValue",
          property: UserValueProperty.PhoneNumber,
          hasValue: false,
        },
      }),
    });
    expect(isPageCurrentlyVisible(absent, {}, extras)).toBe(true);
  });
});
