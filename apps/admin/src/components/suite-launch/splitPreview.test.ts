import type { ParsedSuiteSplit } from "@alliance/shared/parsed-dtos";
import { splitPreview } from "./splitPreview";

const split: ParsedSuiteSplit = {
  id: 4,
  title: "Letters",
  visibilityMode: "combined",
  filterExpression: null,
  launched: false,
  arms: [
    { id: 1, actionId: 1, rule: { type: "USMember" }, optional: false },
    { id: 2, actionId: 2, rule: null, optional: false },
  ],
};

it("counts each arm's members and flags those the split reaches who get no arm", () => {
  expect(
    splitPreview({
      split,
      cohortByActionId: new Map([
        [1, [10]],
        [2, [11]],
      ]),
      reached: [10, 11, 12],
    }),
  ).toEqual({
    splitId: 4,
    title: "Letters",
    arms: [
      { actionId: 1, memberCount: 1 },
      { actionId: 2, memberCount: 1 },
    ],
    reachedCount: 3,
    unroutedUserIds: [12],
  });
});

it("is unknown while an arm's cohort or the split's reach is", () => {
  expect(
    splitPreview({
      split,
      cohortByActionId: new Map([[1, [10]]]),
      reached: [10],
    }),
  ).toBeNull();
  expect(
    splitPreview({
      split,
      cohortByActionId: new Map([
        [1, [10]],
        [2, []],
      ]),
      reached: null,
    }),
  ).toBeNull();
});
