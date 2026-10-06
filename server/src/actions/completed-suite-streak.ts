import { ActionActivityType } from "@alliance/common/actionActivity";
import type { TerminalActivityType } from "./action-activity-status";
import type { SuiteOutcome } from "./missed-suite-streak";

export const TERMINAL_ACTIVITY_COMPLETES: Record<
  TerminalActivityType,
  boolean
> = {
  [ActionActivityType.USER_COMPLETED]: true,
  [ActionActivityType.USER_WONT_COMPLETE]: false,
};

export type CompletedSuiteStreak = {
  count: number;
  /** First suite of the run; null while the count is zero. */
  runSuiteId: number | null;
};

/**
 * The member's trailing run of completed suites. `suites` must be in close
 * order. A suite with a missed required action resets the run; one the member
 * had no required action in, or withdrew from entirely, leaves it unchanged.
 */
export function completedSuiteStreak(
  suites: SuiteOutcome[],
  userId: number,
): CompletedSuiteStreak {
  let streak: CompletedSuiteStreak = { count: 0, runSuiteId: null };
  for (const suite of suites) {
    if (suite.onboarding) continue;
    const missed = suite.missedActionIdsByUser.get(userId);
    if (missed === undefined) continue;
    if (missed.length > 0) {
      streak = { count: 0, runSuiteId: null };
    } else if (suite.completedUserIds.has(userId)) {
      streak = {
        count: streak.count + 1,
        runSuiteId: streak.runSuiteId ?? suite.suiteId,
      };
    }
  }
  return streak;
}
