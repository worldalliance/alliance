import { ActionActivityDto, ActionDto } from "../client/types.gen";

export interface ActionCompletedBarWithInfoPropsShared {
  action: Pick<
    ActionDto,
    | "commitmentThreshold"
    | "status"
    | "everyoneShouldComplete"
    | "usersCompleted"
    | "usersJoined"
    | "optional"
  >;
  friendActivities: ActionActivityDto[] | null;
}

export function getCompletedPercentage(
  action: ActionCompletedBarWithInfoPropsShared["action"]
) {
  const value =
    action.status === "gathering_commitments"
      ? action.usersJoined
      : action.usersCompleted;

  const threshold =
    action.status === "gathering_commitments"
      ? action.commitmentThreshold
      : action.usersJoined;

  if (!threshold) {
    return { labelString: "", percentage: null };
  }

  const safeThreshold = Math.max(threshold, value);

  const noDenominator = action.optional || action.everyoneShouldComplete;

  const labelString = noDenominator ? value : `${value} / ${safeThreshold}`;

  const percentage = noDenominator ? 100 : (value / safeThreshold) * 100;

  return { labelString, percentage };
}
