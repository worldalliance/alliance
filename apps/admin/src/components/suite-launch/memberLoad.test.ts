import { describe, expect, it } from "bun:test";
import { actionMixes, memberLoads } from "./memberLoad";

describe("memberLoads", () => {
  it("sums each member's assigned time estimates, heaviest first", () => {
    expect(
      memberLoads({
        actions: [
          { id: 1, timeEstimate: 10 },
          { id: 2, timeEstimate: 8 },
          { id: 3, timeEstimate: null },
        ],
        cohortByActionId: new Map([
          [1, [100, 101]],
          [2, [101, 102]],
          [3, [102]],
        ]),
      }),
    ).toEqual([
      { userId: 101, actionIds: [1, 2], minutes: 18 },
      { userId: 100, actionIds: [1], minutes: 10 },
      { userId: 102, actionIds: [2, 3], minutes: 8 },
    ]);
  });

  it("treats an action without an evaluated cohort as assigned to no one", () => {
    expect(
      memberLoads({
        actions: [{ id: 1, timeEstimate: 5 }],
        cohortByActionId: new Map(),
      }),
    ).toEqual([]);
  });
});

describe("actionMixes", () => {
  it("groups members by the exact set of actions they get, most common first", () => {
    expect(
      actionMixes([
        { userId: 1, actionIds: [1, 2], minutes: 18 },
        { userId: 2, actionIds: [1], minutes: 10 },
        { userId: 3, actionIds: [1], minutes: 10 },
      ]),
    ).toEqual([
      { actionIds: [1], minutes: 10, userIds: [2, 3] },
      { actionIds: [1, 2], minutes: 18, userIds: [1] },
    ]);
  });
});
