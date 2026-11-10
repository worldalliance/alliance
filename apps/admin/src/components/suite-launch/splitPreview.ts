import type { ParsedSuiteSplit } from "@alliance/shared/parsed-dtos";

export type SplitPreview = {
  splitId: number;
  title: string;
  arms: { actionId: number; memberCount: number }[];
  reachedCount: number;
  /** Members the split's filter reaches whom no arm's cohort includes. */
  unroutedUserIds: number[];
};

/** Null while any arm's cohort or the split's reach is unknown. */
export function splitPreview(params: {
  split: ParsedSuiteSplit;
  cohortByActionId: ReadonlyMap<number, readonly number[]>;
  reached: readonly number[] | null;
}): SplitPreview | null {
  const { split, cohortByActionId, reached } = params;
  const cohorts = split.arms.map((arm) => cohortByActionId.get(arm.actionId));
  if (reached === null || cohorts.some((cohort) => cohort === undefined)) {
    return null;
  }
  const routed = new Set(cohorts.flatMap((cohort) => cohort ?? []));
  return {
    splitId: split.id,
    title: split.title,
    arms: split.arms.map((arm, index) => ({
      actionId: arm.actionId,
      memberCount: cohorts[index]?.length ?? 0,
    })),
    reachedCount: reached.length,
    unroutedUserIds: reached.filter((userId) => !routed.has(userId)),
  };
}
