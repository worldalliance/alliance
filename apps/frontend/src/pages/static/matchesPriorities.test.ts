import { ActionPriority } from "../../content/featuredImpactActions";
import { matchesPriorities } from "./matchesPriorities";

test("matches everything when no priority is selected", () => {
  expect(matchesPriorities([ActionPriority.Poverty], [])).toBe(true);
});

test("matches when any tag is selected", () => {
  expect(
    matchesPriorities(
      [ActionPriority.Technology, ActionPriority.Democracy],
      [ActionPriority.Democracy],
    ),
  ).toBe(true);
});

test("does not match when no tag is selected", () => {
  expect(
    matchesPriorities([ActionPriority.Poverty], [ActionPriority.Environment]),
  ).toBe(false);
});
