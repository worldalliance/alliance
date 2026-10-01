/** Consecutive missed suites that suspend an agreement. */
export const SUSPENSION_MISSED_SUITE_COUNT = 3;

/**
 * One closed suite's outcome for every member it counted for. A member is
 * keyed only when they had a required assignment in the suite during their
 * current signing period; their entry lists the required actions they left
 * without a completion or withdrawal, so an empty list means satisfied.
 */
export type SuiteOutcome = {
  suiteId: number;
  closedAt: Date;
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
