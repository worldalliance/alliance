import type { CohortExpression } from "@alliance/common/cohort-expression";
import {
  type ActionBranch,
  applyVariantToAction,
  firstMatchingBranchIds,
  routedCohortExpression,
} from "./action-branches";
import type { ActionFormVariant } from "./entities/action-form-variant.entity";
import type { Action } from "./entities/action.entity";

const allMembers: CohortExpression = { type: "AllMembers" };

const branch = (id: number, rule: CohortExpression) =>
  ({ id, rule, position: id }) as ActionBranch;

describe("routedCohortExpression", () => {
  it("leaves an unbranched action's cohort as it is", () => {
    expect(routedCohortExpression(allMembers, [])).toBe(allMembers);
  });

  it("requires a branched action's members to match a branch", () => {
    const yes: CohortExpression = { type: "Manual", userIds: [1] };
    const no: CohortExpression = { type: "Manual", userIds: [2] };

    expect(
      routedCohortExpression(allMembers, [branch(1, yes), branch(2, no)]),
    ).toEqual({
      type: "AND",
      children: [allMembers, { type: "OR", children: [yes, no] }],
    });
  });

  it("keeps a missing cohort missing", () => {
    expect(routedCohortExpression(null, [branch(1, allMembers)])).toBeNull();
  });
});

describe("firstMatchingBranchIds", () => {
  it("routes each member to the first branch whose members include them", () => {
    const branches = [branch(10, allMembers), branch(20, allMembers)];

    expect(
      firstMatchingBranchIds({
        branches,
        matches: [new Set([1]), new Set([1, 2])],
        userIds: [1, 2, 3],
      }),
    ).toEqual(
      new Map([
        [1, 10],
        [2, 20],
      ]),
    );
  });
});

describe("applyVariantToAction", () => {
  it("lays set overrides over the action and keeps the rest", () => {
    const action = {
      taskFormId: 1,
      name: "Base",
      shortDescription: "Base short",
      body: "Base body",
      timeEstimate: 10,
      image: "base.png",
      squareThumbnailImage: undefined,
      squareThumbnailImageAlt: null,
    } as Action;

    applyVariantToAction(action, {
      formId: 2,
      nameOverride: "Branch",
      shortDescriptionOverride: null,
      bodyOverride: "Branch body",
      timeEstimateOverride: 0,
      imageOverride: null,
      squareThumbnailImageOverride: null,
      squareThumbnailImageAltOverride: null,
    } as ActionFormVariant);

    expect(action).toMatchObject({
      taskFormId: 2,
      name: "Branch",
      shortDescription: "Base short",
      body: "Branch body",
      timeEstimate: 0,
      image: "base.png",
    });
  });
});
