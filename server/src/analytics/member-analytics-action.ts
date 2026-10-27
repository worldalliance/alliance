import type { Action } from "src/actions/entities/action.entity";

/**
 * Whether an action belongs in any member metric. Each metric adds its own
 * conditions, such as whether optional actions count.
 */
export function countsTowardMemberAnalytics(
  action: Pick<Action, "publicOnly" | "onboarding">,
): boolean {
  return !action.publicOnly && !action.onboarding;
}

/**
 * Whether a member's assignment counts toward their completion rate. An
 * optional branch or a "Doesn't apply to me" withdrawal costs nothing; a
 * completion always counts.
 */
export function countsTowardCompletionRate(params: {
  completed: boolean;
  onOptionalBranch: boolean;
  withdrewDoesntApply: boolean;
}): boolean {
  const { completed, onOptionalBranch, withdrewDoesntApply } = params;
  return completed || (!onOptionalBranch && !withdrewDoesntApply);
}
