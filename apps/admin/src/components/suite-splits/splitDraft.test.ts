import type { CohortExpression } from "@alliance/common/cohort-expression";
import {
  emptySplitDraft,
  moveArm,
  newArmDraft,
  saveSplitBody,
  splitDraftProblems,
  type SplitDraft,
} from "./splitDraft";

const usMembers: CohortExpression = { type: "USMember" };

const draft = (overrides: Partial<SplitDraft> = {}): SplitDraft => ({
  ...emptySplitDraft(),
  title: "Letters",
  arms: [
    { ...newArmDraft(1), rule: usMembers },
    { ...newArmDraft(2), optional: true },
  ],
  ...overrides,
});

it("starts a new split as combined, with two empty arms and no filter", () => {
  const empty = emptySplitDraft();

  expect(empty.visibilityMode).toBe("combined");
  expect(empty.filterExpression).toBeNull();
  expect(empty.arms.map((arm) => arm.actionId)).toEqual([null, null]);
});

it("sends no rule for the last arm, even one it kept from higher up", () => {
  const body = saveSplitBody(
    draft({
      arms: moveArm(draft().arms, { from: 0, to: 1 }).map((arm) => ({
        ...arm,
        rule: usMembers,
      })),
    }),
  );

  expect(body?.arms).toEqual([
    { actionId: 2, rule: usMembers, optional: true },
    { actionId: 1, rule: null, optional: false },
  ]);
});

it("names each missing piece and saves nothing until they're filled", () => {
  const incomplete = draft({
    title: " ",
    arms: [newArmDraft(), { ...newArmDraft(2), rule: usMembers }],
  });

  expect(splitDraftProblems(incomplete)).toEqual([
    "Give the split a title.",
    "Pick an action for arm 1.",
    "Give arm 1 a rule.",
  ]);
  expect(saveSplitBody(incomplete)).toBeNull();
});

it("needs at least two arms", () => {
  expect(splitDraftProblems(draft({ arms: [newArmDraft(1)] }))).toEqual([
    "A split needs at least two arms.",
  ]);
});

it("leaves the arms as they are when a move runs off either end", () => {
  const arms = draft().arms;

  expect(moveArm(arms, { from: 0, to: -1 })).toBe(arms);
  expect(moveArm(arms, { from: 1, to: 2 })).toBe(arms);
});
