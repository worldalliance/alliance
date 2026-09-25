import {
  collectCohortDependencies,
  type CohortExpression,
} from "./cohort-expression";

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
            { type: "InProgressAction", actionId: 2 },
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
      ],
    };

    expect(collectCohortDependencies(expr)).toEqual({
      actionIds: new Set([1, 2, 3]),
      formIds: new Set([7]),
    });
  });
});
