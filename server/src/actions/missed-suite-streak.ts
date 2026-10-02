/** Consecutive missed suites that suspend an agreement. */
export const SUSPENSION_MISSED_SUITE_COUNT = 3;

export type SuiteOutcomeAction = {
  id: number;
  name: string;
  timeEstimate?: number;
};

/**
 * One closed suite's outcome for every member it counted for. A member is
 * keyed only when they had a required assignment in the suite during their
 * current signing period; their entry lists the required actions they left
 * without a completion or withdrawal, so an empty list means satisfied.
 */
export type SuiteOutcome = {
  suiteId: number;
  closedAt: Date;
  actions: SuiteOutcomeAction[];
  missedActionIdsByUser: Map<number, number[]>;
};

/**
 * Suite ids of the member's trailing run of missed suites, oldest first.
 * `suites` must be in close order. A satisfied suite resets the run; a suite
 * that did not count for the member leaves it unchanged.
 */
export function trailingMissedSuiteIds(
  suites: SuiteOutcome[],
  userId: number,
): number[] {
  const run: number[] = [];
  for (const suite of suites) {
    const missed = suite.missedActionIdsByUser.get(userId);
    if (!missed) continue;
    if (missed.length === 0) {
      run.length = 0;
    } else {
      run.push(suite.suiteId);
    }
  }
  return run;
}

/**
 * Stable while the run grows, so `ContractEvent`'s `(user, autoSuspendKey)`
 * constraint still dedupes a run that outlasts its first suspension check.
 */
export function suspensionReasonKey(run: number[]): string {
  return `s-${run.slice(0, SUSPENSION_MISSED_SUITE_COUNT).join("-")}`;
}

export type MissedSuiteStanding = {
  /** Position of this suite in the member's run of consecutive misses. */
  missNumber: number;
  missedActions: SuiteOutcomeAction[];
  isFirstAssignedSuite: boolean;
};

/** The member's standing at `suiteId`, or null unless they missed it. */
export function findMissedSuiteStanding(params: {
  suites: SuiteOutcome[];
  userId: number;
  suiteId: number;
}): MissedSuiteStanding | null {
  const { suites, userId, suiteId } = params;
  const index = suites.findIndex((suite) => suite.suiteId === suiteId);
  if (index === -1) return null;
  const suite = suites[index];
  const missedIds = suite.missedActionIdsByUser.get(userId);
  if (!missedIds?.length) return null;
  const through = suites.slice(0, index + 1);
  return {
    missNumber: trailingMissedSuiteIds(through, userId).length,
    missedActions: suite.actions.filter((action) =>
      missedIds.includes(action.id),
    ),
    isFirstAssignedSuite:
      through.filter((s) => s.missedActionIdsByUser.has(userId)).length === 1,
  };
}
