import { makeParsedAction } from "../../lib/testing/parsedAction";
import { taskVisibility } from "./taskFacts";

test.each([
  [{}, "Admins only"],
  [{ staffPreview: true }, "Admins, and staff while staff preview is on"],
  [{ staffPreview: true, archived: true }, "Admins only"],
  [{ publicOnly: true }, "Anyone who has the link, though no feed lists it"],
  [
    { publicOnly: true, staffPreview: true, archived: true },
    "Anyone who has the link, though no feed lists it",
  ],
])("a draft with %o is seen by: %s", (overrides, asDraft) => {
  expect(taskVisibility(makeParsedAction(overrides)).asDraft).toBe(asDraft);
});

test.each([
  ["public", "Anyone, signed in or not"],
  ["all_members", "Every signed-in member"],
  ["participating_groups", "Members in the cohort"],
] as const)("out of draft, a %s task is seen by: %s", (visibilityMode, who) => {
  expect(taskVisibility(makeParsedAction({ visibilityMode })).outOfDraft).toBe(
    who,
  );
});
