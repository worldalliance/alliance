import { ActionActivityType } from "@alliance/common/actionActivity";
import { withCount } from "@alliance/common/plural";
import { ActionActivityDto, ActionDto, ProfileDto } from "../client/types.gen";
import { useAllianceMemberCount } from "./useAllianceMemberCount";

export interface ActionCompletedBarWithInfoPropsShared {
  action: Pick<
    ActionDto,
    | "status"
    | "onboarding"
    | "usersCompleted"
    | "usersJoined"
    | "optional"
    | "id"
  >;
  friendActivities: ActionActivityDto[] | null;
}

/** Few enough faces that they and the completion count share one line. */
export const MAX_COMPLETED_FACES = 3;

export const selectCompletedFriends = (
  friendActivities: ActionActivityDto[] | null,
): ProfileDto[] =>
  (friendActivities ?? [])
    .filter((activity) => activity.type === ActionActivityType.USER_COMPLETED)
    .map((activity) => activity.user);

export interface ActionDisplayCount {
  count: number | undefined;
  isError: boolean;
}

export function useActionDisplayCount(
  action: Pick<ActionDto, "onboarding" | "usersCompleted">,
): ActionDisplayCount {
  const { data, isError } = useAllianceMemberCount({
    enabled: action.onboarding,
  });
  return action.onboarding
    ? { count: data, isError }
    : { count: action.usersCompleted, isError: false };
}

export function getCompletedPercentage(
  action: Pick<ActionDto, "onboarding" | "optional" | "usersJoined">,
  { count, isError }: ActionDisplayCount,
) {
  if (count === undefined) {
    return {
      labelString: isError ? "Member count unavailable" : "... members",
      percentage: isError ? 0 : 100,
      hasDenominator: false,
    };
  }

  const threshold = action.onboarding ? count : action.usersJoined;

  if (!threshold) {
    return { labelString: "", percentage: null, hasDenominator: false };
  }

  if (action.onboarding) {
    return {
      labelString: withCount(count, "member"),
      percentage: 100,
      hasDenominator: false,
    };
  }

  if (action.optional) {
    return {
      labelString: `${withCount(count, "member")} completed`,
      percentage: 100,
      hasDenominator: false,
    };
  }

  const safeThreshold = Math.max(threshold, count);

  return {
    labelString: `${count} / ${withCount(safeThreshold, "member")} completed`,
    percentage: (count / safeThreshold) * 100,
    hasDenominator: true,
  };
}
