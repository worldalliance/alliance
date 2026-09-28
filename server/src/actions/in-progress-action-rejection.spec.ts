import type { CohortExpression } from "@alliance/common/cohort-expression";
import { findAddedInProgressActionIds } from "./in-progress-action-rejection";

describe("findAddedInProgressActionIds", () => {
  const inProgress = (actionId: number): CohortExpression => ({
    type: "InProgressAction",
    actionId,
  });

  it("finds every leaf of a new expression", () => {
    expect(
      findAddedInProgressActionIds({
        stored: null,
        next: { type: "NOT", child: inProgress(1) },
      }),
    ).toEqual([1]);
  });

  it("keeps existing leaves, even moved within the expression", () => {
    expect(
      findAddedInProgressActionIds({
        stored: inProgress(1),
        next: { type: "OR", children: [{ type: "GroupLead" }, inProgress(1)] },
      }),
    ).toEqual([]);
  });

  it("finds a leaf for another action", () => {
    expect(
      findAddedInProgressActionIds({
        stored: inProgress(1),
        next: { type: "AND", children: [inProgress(1), inProgress(2)] },
      }),
    ).toEqual([2]);
  });

  it("finds a second leaf for an action the expression already reads", () => {
    expect(
      findAddedInProgressActionIds({
        stored: inProgress(1),
        next: { type: "AND", children: [inProgress(1), inProgress(1)] },
      }),
    ).toEqual([1]);
  });

  it("names each added action once", () => {
    expect(
      findAddedInProgressActionIds({
        stored: null,
        next: { type: "OR", children: [inProgress(2), inProgress(2)] },
      }),
    ).toEqual([2]);
  });
});
