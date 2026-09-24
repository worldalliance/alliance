import {
  ActionCompletedBarWithInfoPropsShared,
  getCompletedPercentage,
} from "@alliance/shared/lib/actionCompletedBarWithInfo";
import { cn } from "@alliance/shared/styles/util";
import CompletedBar from "@alliance/sharedweb/ui/CompletedBar";
import InfoTooltip from "@alliance/sharedweb/ui/InfoTooltip";
import { useMemo } from "react";
import { href, Link } from "react-router";
import UserProfilePicRow from "../../components/UserProfilePicRow";

interface ActionCompletedBarWithInfoProps extends ActionCompletedBarWithInfoPropsShared {
  className?: string;
  textSize?: "sm" | "base";
  textColor?: string;
  showInfoTooltip?: boolean;
  seeAllLink?: boolean;
  dark?: boolean;
  barRounded?: string;
  barClassName?: string;
  barFillClassName?: string;
}

const ActionCompletedBarWithInfo: React.FC<ActionCompletedBarWithInfoProps> = ({
  action,
  friendActivities,
  className,
  textSize = "sm",
  textColor = "zinc-500",
  showInfoTooltip = false,
  seeAllLink = false,
  dark = false,
  barRounded,
  barClassName,
  barFillClassName,
}: ActionCompletedBarWithInfoProps) => {
  const { labelString, percentage } = getCompletedPercentage(action);

  const completedFriends = useMemo(() => {
    return (
      friendActivities?.filter(
        (activity) => activity.type === "user_completed",
      ) ?? []
    ).map((activity) => activity.user);
  }, [friendActivities]);

  if (percentage === null) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex flex-row items-center justify-between w-full gap-x-2">
        <div className="flex flex-row items-center gap-x-2 mb-1">
          <p className={cn(`text-${textSize}`, `text-${textColor}`)}>
            {labelString}
          </p>
          {showInfoTooltip && (
            <InfoTooltip
              content={
                <p>
                  The denominator is the number of members expected to complete
                  this action. Sometimes, different members are expected to
                  complete different actions, or may have marked themselves as
                  &quot;Away&quot; in settings.
                </p>
              }
            />
          )}
          {seeAllLink && (
            <Link
              to={href("/feed/:actionId", { actionId: action.id.toString() })}
            >
              <p className="text-link">See all</p>
            </Link>
          )}
        </div>
        {completedFriends.length > 0 && (
          <UserProfilePicRow users={completedFriends} />
        )}
      </div>
      <CompletedBar
        percentage={percentage}
        dark={dark}
        rounded={barRounded}
        className={barClassName}
        fillClassName={barFillClassName}
      />
    </div>
  );
};

export default ActionCompletedBarWithInfo;
