import {
  collectCohortDependencies,
  findUnawaitedOpenReferences,
  type CohortExpression,
  type ReferencedAction,
} from "./cohort-expression";

const LAUNCH = new Date("2026-01-10T00:00:00Z");

const action = (
  id: number,
  overrides: Partial<ReferencedAction> = {},
): ReferencedAction => ({
  id,
  formIds: [],
  deadline: new Date("2026-01-12T00:00:00Z"),
  onboarding: false,
  ...overrides,
});

describe("findUnawaitedOpenReferences", () => {
  it("flags an action still open at launch", () => {
    expect(
      findUnawaitedOpenReferences({
        actionId: 99,
        expression: { type: "CompletedAction", actionId: 1 },
        prerequisiteActionIds: [],
        decidedAt: LAUNCH,
        actions: [action(1), action(2)],
      }),
    ).toEqual([1]);
  });

  it("flags an open action read through its task form", () => {
    expect(
      findUnawaitedOpenReferences({
        actionId: 99,
        expression: {
          type: "NOT",
          child: { type: "FormFieldValue", formId: 7, fieldId: "f" },
        },
        prerequisiteActionIds: [],
        decidedAt: LAUNCH,
        actions: [action(1, { formIds: [7] })],
      }),
    ).toEqual([1]);
  });

  it("flags an open action read through a variant's form", () => {
    expect(
      findUnawaitedOpenReferences({
        actionId: 99,
        expression: { type: "FormFieldValue", formId: 8, fieldId: "f" },
        prerequisiteActionIds: [],
        decidedAt: LAUNCH,
        actions: [action(1, { formIds: [7, 8] })],
      }),
    ).toEqual([1]);
  });

  it("flags an open action without a deadline", () => {
    expect(
      findUnawaitedOpenReferences({
        actionId: 99,
        expression: { type: "MissedActionDeadline", actionId: 1 },
        prerequisiteActionIds: [],
        decidedAt: LAUNCH,
        actions: [action(1, { deadline: null })],
      }),
    ).toEqual([1]);
  });

  it("skips prerequisites and actions closed by launch", () => {
    expect(
      findUnawaitedOpenReferences({
        actionId: 99,
        expression: {
          type: "OR",
          children: [
            { type: "CompletedAction", actionId: 1 },
            { type: "CompletedAction", actionId: 2 },
          ],
        },
        prerequisiteActionIds: [1],
        decidedAt: LAUNCH,
        actions: [action(1), action(2, { deadline: LAUNCH })],
      }),
    ).toEqual([]);
  });

  it("flags an onboarding action closed by launch, even as a prerequisite", () => {
    expect(
      findUnawaitedOpenReferences({
        actionId: 99,
        expression: { type: "CompletedAction", actionId: 1 },
        prerequisiteActionIds: [1],
        decidedAt: LAUNCH,
        actions: [action(1, { deadline: LAUNCH, onboarding: true })],
      }),
    ).toEqual([1]);
  });

  it("skips the action itself", () => {
    expect(
      findUnawaitedOpenReferences({
        actionId: 1,
        expression: { type: "FormFieldValue", formId: 7, fieldId: "f" },
        prerequisiteActionIds: [],
        decidedAt: LAUNCH,
        actions: [action(1, { formIds: [7] })],
      }),
    ).toEqual([]);
  });
});

describe("collectCohortDependencies", () => {
  it("returns empty sets without an expression", () => {
    expect(collectCohortDependencies(null)).toEqual({
      actionIds: new Set(),
      formIds: new Set(),
    });
  });

  it("collects action and form ids nested under every operator, once each", () => {
    const expr: CohortExpression = {
      type: "AND",
      children: [
        { type: "CompletedAction", actionId: 1 },
        {
          type: "OR",
          children: [
            { type: "MissedActionDeadline", actionId: 2 },
            { type: "CompletedAction", actionId: 1 },
          ],
        },
        {
          type: "NOT",
          child: { type: "MissedActionDeadline", actionId: 3 },
        },
        {
          type: "FormFieldValue",
          formId: 7,
          fieldId: "town",
          responseEqualTo: "Paris",
        },
        { type: "Tag", tagId: "tag" },
        { type: "Manual", userIds: [5] },
        { type: "GroupLead" },
        { type: "USMember" },
        { type: "NonUSMember" },
        { type: "AllMembers" },
        { type: "Staff" },
      ],
    };

    expect(collectCohortDependencies(expr)).toEqual({
      actionIds: new Set([1, 2, 3]),
      formIds: new Set([7]),
    });
  });
});
