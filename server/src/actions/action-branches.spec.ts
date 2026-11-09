import type { CohortExpression } from "@alliance/common/cohort-expression";
import {
  applyAssignedForm,
  firstMatchingBranchIds,
  routedCohortExpression,
  sortBranches,
} from "./action-branches";
import { ActionBranch } from "./entities/action-branch.entity";
import { Action } from "./entities/action.entity";

const allMembers: CohortExpression = { type: "AllMembers" };

const branch = (id: number, rule: CohortExpression, position = id) =>
  Object.assign(new ActionBranch(), { id, rule, position });

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

describe("sortBranches", () => {
  it("orders by position, then id", () => {
    const sorted = sortBranches([
      branch(3, allMembers, 0),
      branch(1, allMembers, 1),
      branch(2, allMembers, 0),
    ]);

    expect(sorted.map((b) => b.id)).toEqual([2, 3, 1]);
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

describe("applyAssignedForm", () => {
  const baseAction = () =>
    Object.assign(new Action(), {
      taskFormId: 1,
      name: "Base",
      shortDescription: "Base short",
      body: "Base body",
      timeEstimate: 10,
      image: "base.png",
      squareThumbnailImage: null,
      squareThumbnailImageAlt: null,
    });

  it("lays a branch's set overrides over the action and keeps the rest", () => {
    const action = baseAction();

    applyAssignedForm(action, {
      formId: 2,
      branch: Object.assign(new ActionBranch(), {
        nameOverride: "Branch",
        shortDescriptionOverride: null,
        bodyOverride: "Branch body",
        timeEstimateOverride: 0,
        imageOverride: null,
        squareThumbnailImageOverride: null,
        squareThumbnailImageAltOverride: null,
      }),
    });

    expect(action).toMatchObject({
      taskFormId: 2,
      name: "Branch",
      shortDescription: "Base short",
      body: "Branch body",
      timeEstimate: 0,
      image: "base.png",
    });
  });

  it("swaps only the form for a variant", () => {
    const action = baseAction();

    applyAssignedForm(action, { formId: 3, branch: null });

    expect(action).toMatchObject({ taskFormId: 3, name: "Base" });
  });
});
