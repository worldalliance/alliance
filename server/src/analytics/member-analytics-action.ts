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
