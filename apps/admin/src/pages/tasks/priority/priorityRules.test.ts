import { describe, expect, it } from "bun:test";
import { PlacementBadge } from "../../../lib/homePlacement";
import {
  movedAnnouncement,
  MoveDirection,
  moveOne,
  movesFrom,
  prioritiesOf,
  PriorityKind,
  type PriorityItem,
} from "./priorityRules";

const task = (id: number): PriorityItem => ({
  kind: PriorityKind.Task,
  id,
  name: `Task ${id}`,
  suiteName: undefined,
  placement: { badges: [PlacementBadge.ActiveTask], inactive: null },
});
const divider: PriorityItem = { kind: PriorityKind.Divider };

describe("prioritiesOf", () => {
  it("counts each row's distance above the line", () => {
    expect(prioritiesOf([task(1), task(2), divider, task(3)])).toEqual({
      actionPriorities: [
        { id: 1, priority: 2 },
        { id: 2, priority: 1 },
        { id: 3, priority: -1 },
      ],
      generalUpdatePriorities: [],
    });
  });
});

describe("moveOne", () => {
  const list = [task(1), divider, task(2)];

  it("moves a row up and down one place", () => {
    expect(
      moveOne({ items: list, index: 2, direction: MoveDirection.Up }),
    ).toEqual([task(1), task(2), divider]);
    expect(
      moveOne({ items: list, index: 0, direction: MoveDirection.Down }),
    ).toEqual([divider, task(1), task(2)]);
  });

  it("does nothing past either end", () => {
    expect(
      moveOne({ items: list, index: 0, direction: MoveDirection.Up }),
    ).toBeNull();
    expect(
      moveOne({ items: list, index: 2, direction: MoveDirection.Down }),
    ).toBeNull();
  });
});

describe("movesFrom", () => {
  it("counts a row new since the start as unmoved", () => {
    const { moved, anyChanged } = movesFrom({
      from: [task(1), divider],
      items: [task(3), divider, task(1)],
    });
    expect(anyChanged).toBe(true);
    expect(moved.get("task-1")).toBe(-2);
    expect(moved.has("task-3")).toBe(false);
  });
});

describe("movedAnnouncement", () => {
  const items = [task(1), divider, task(2), task(3)];
  it("counts positions among items, leaving out the line", () => {
    expect(movedAnnouncement({ items, key: "task-3" })).toBe(
      "Task 3 is now 3 of 3, below the line for new items.",
    );
    expect(movedAnnouncement({ items, key: "task-1" })).toBe(
      "Task 1 is now 1 of 3, above the line for new items.",
    );
  });
  it("places the line by the item above it", () => {
    expect(movedAnnouncement({ items, key: PriorityKind.Divider })).toBe(
      "The line for new items is now below item 1 of 3.",
    );
    expect(
      movedAnnouncement({
        items: [divider, task(1)],
        key: PriorityKind.Divider,
      }),
    ).toBe("The line for new items is now at the top, above every item.");
  });
});
