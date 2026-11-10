import type { CohortExpression } from "@alliance/common/cohort-expression";
import type {
  SaveSuiteSplitDto,
  SplitVisibilityMode,
} from "@alliance/shared/client";
import type { ParsedSuiteSplit } from "@alliance/shared/parsed-dtos";

export type ArmDraft = {
  key: string;
  actionId: number | null;
  /** Kept while the arm is last, where it's ignored, so moving it back up restores it. */
  rule: CohortExpression | null;
  optional: boolean;
};

export type SplitDraft = {
  title: string;
  visibilityMode: SplitVisibilityMode;
  filterExpression: CohortExpression | null;
  arms: ArmDraft[];
};

export const VISIBILITY_MODE_LABELS: Record<
  SplitVisibilityMode,
  { label: string; explanation: string }
> = {
  combined: {
    label: "Combined",
    explanation:
      "Other members see the split's title and counts summed across its arms, never which arm a member got.",
  },
  per_arm: {
    label: "Per arm",
    explanation:
      "Other members see each arm as its own action, under its own title and visibility mode.",
  },
};

let nextKey = 0;
export const newArmDraft = (actionId: number | null = null): ArmDraft => ({
  key: `arm-${nextKey++}`,
  actionId,
  rule: null,
  optional: false,
});

export const emptySplitDraft = (): SplitDraft => ({
  title: "",
  visibilityMode: "combined",
  filterExpression: null,
  arms: [newArmDraft(), newArmDraft()],
});

export const splitDraftOf = (split: ParsedSuiteSplit): SplitDraft => ({
  title: split.title,
  visibilityMode: split.visibilityMode,
  filterExpression: split.filterExpression,
  arms: split.arms.map((arm) => ({
    ...newArmDraft(arm.actionId),
    rule: arm.rule,
    optional: arm.optional,
  })),
});

export const moveArm = (
  arms: ArmDraft[],
  move: { from: number; to: number },
): ArmDraft[] => {
  if (move.to < 0 || move.to >= arms.length) return arms;
  const next = arms.slice();
  const [arm] = next.splice(move.from, 1);
  next.splice(move.to, 0, arm);
  return next;
};

export const splitDraftProblems = (draft: SplitDraft): string[] => {
  const problems: string[] = [];
  if (draft.title.trim() === "") problems.push("Give the split a title.");
  if (draft.arms.length < 2) problems.push("A split needs at least two arms.");
  draft.arms.forEach((arm, index) => {
    if (arm.actionId === null) {
      problems.push(`Pick an action for arm ${index + 1}.`);
    }
    if (index < draft.arms.length - 1 && arm.rule === null) {
      problems.push(`Give arm ${index + 1} a rule.`);
    }
  });
  return problems;
};

/** Null while the draft has problems. */
export const saveSplitBody = (draft: SplitDraft): SaveSuiteSplitDto | null => {
  if (splitDraftProblems(draft).length > 0) return null;
  return {
    title: draft.title.trim(),
    visibilityMode: draft.visibilityMode,
    filterExpression: draft.filterExpression,
    arms: draft.arms.flatMap((arm, index) =>
      arm.actionId === null
        ? []
        : [
            {
              actionId: arm.actionId,
              rule: index === draft.arms.length - 1 ? null : arm.rule,
              optional: arm.optional,
            },
          ],
    ),
  };
};
