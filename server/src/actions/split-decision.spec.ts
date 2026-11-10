import { describe, expect, it } from "bun:test";
import {
  awaitSplitPrerequisites,
  groupSplitArms,
  splitIdByArm,
} from "./split-decision";

function split(id: number, armIds: number[]) {
  return { id, arms: armIds.map((actionId) => ({ actionId })) };
}

describe("groupSplitArms", () => {
  const item = (id: number) => ({ action: { id } });

  it("groups a split's arms at its last arm's place", () => {
    const ids = splitIdByArm([split(9, [2, 4])]);
    const groups = groupSplitArms([1, 2, 3, 4, 5].map(item), ids);
    expect(groups.map((group) => group.map(({ action }) => action.id))).toEqual(
      [[1], [3], [2, 4], [5]],
    );
  });
});

describe("awaitSplitPrerequisites", () => {
  it("makes every arm wait on all arms' prerequisites", () => {
    const actions = [
      { id: 1, prerequisiteActionIds: [10] },
      { id: 2, prerequisiteActionIds: [11] },
      { id: 3, prerequisiteActionIds: [12] },
    ];
    awaitSplitPrerequisites({ actions, splits: [split(9, [1, 2])] });
    expect(actions.map((action) => action.prerequisiteActionIds)).toEqual([
      [10, 11],
      [10, 11],
      [12],
    ]);
  });

  it("throws when only some arms are loaded", () => {
    expect(() =>
      awaitSplitPrerequisites({
        actions: [{ id: 1, prerequisiteActionIds: [] }],
        splits: [split(9, [1, 2])],
      }),
    ).toThrow("Loaded only some arms of split 9");
  });
});
