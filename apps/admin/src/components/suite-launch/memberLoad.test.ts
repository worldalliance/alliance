import { describe, expect, it } from "bun:test";
import { actionMixes, memberLoads } from "./memberLoad";

const load = (params: {
  userId: number;
  actionIds: number[];
  minutes: number;
  otherActionIds?: number[];
  otherMinutes?: number;
}) => ({ otherActionIds: [], otherMinutes: 0, ...params });

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
      load({ userId: 101, actionIds: [1, 2], minutes: 18 }),
      load({ userId: 100, actionIds: [1], minutes: 10 }),
      load({ userId: 102, actionIds: [2, 3], minutes: 8 }),
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

  it("adds other live actions to the suite's members only, ranking by the total", () => {
    expect(
      memberLoads({
        actions: [{ id: 1, timeEstimate: 10 }],
        otherActions: [{ id: 9, timeEstimate: 6 }],
        cohortByActionId: new Map([
          [1, [100, 101]],
          [9, [101, 200]],
        ]),
      }),
    ).toEqual([
      load({
        userId: 101,
        actionIds: [1],
        minutes: 10,
        otherActionIds: [9],
        otherMinutes: 6,
      }),
      load({ userId: 100, actionIds: [1], minutes: 10 }),
    ]);
  });
});

describe("actionMixes", () => {
  it("groups members by the exact set of actions they get, most common first", () => {
    expect(
      actionMixes([
        load({ userId: 1, actionIds: [1, 2], minutes: 18 }),
        load({ userId: 2, actionIds: [1], minutes: 10 }),
        load({ userId: 3, actionIds: [1], minutes: 10 }),
      ]),
    ).toEqual([
      { actionIds: [1], minutes: 10, userIds: [2, 3] },
      { actionIds: [1, 2], minutes: 18, userIds: [1] },
    ]);
  });
});
