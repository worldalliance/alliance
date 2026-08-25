import { withCount } from "@alliance/common/plural";
import { ActionActivityDto, ActionDto } from "../client/types.gen";

export interface ActionCompletedBarWithInfoPropsShared {
  action: Pick<
    ActionDto,
    | "status"
    | "onboarding"
    | "usersCompleted"
    | "usersJoined"
    | "optional"
    | "customStatType"
    | "customStatValue"
    | "customStatGoal"
    | "customStatLabel"
    | "id"
  >;
  friendActivities: ActionActivityDto[] | null;
}

export function getCompletedPercentage(
  action: ActionCompletedBarWithInfoPropsShared["action"],
) {
  const value = action.usersCompleted;
  const threshold = action.usersJoined;

  if (!threshold) {
    return { labelString: "", percentage: null };
  }

  const safeThreshold = Math.max(threshold, value);

  const noDenominator = action.optional || action.onboarding;

  const labelString = noDenominator
    ? `${withCount(value, "member")} completed`
    : `${value} / ${withCount(safeThreshold, "member")} completed`;

  const percentage = noDenominator ? 100 : (value / safeThreshold) * 100;

  return { labelString, percentage };
}
