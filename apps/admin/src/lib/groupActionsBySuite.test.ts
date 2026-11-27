import { groupBySuite } from "./groupActionsBySuite";
import { adminActionListItem } from "./testing/adminActionListItem";

const suite = (id: number) => ({
  id,
  name: `Suite ${id}`,
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  events: [],
});

it("ranks each suite by its first unarchived action, archived-only suites last", () => {
  const groups = groupBySuite([
    adminActionListItem(1, "A archived", { suite: suite(1), archived: true }),
    adminActionListItem(2, "B", { suite: suite(2) }),
    adminActionListItem(3, "A", { suite: suite(1) }),
    adminActionListItem(4, "C archived", { suite: suite(3), archived: true }),
    adminActionListItem(5, "Loose"),
  ]);

  expect(
    groups.map(({ id, name, actions }) => [
      id,
      name,
      actions.map((action) => action.id),
    ]),
  ).toEqual([
    [2, "Suite 2", [2]],
    [1, "Suite 1", [1, 3]],
    [null, "No suite", [5]],
    [3, "Suite 3", [4]],
  ]);
});
