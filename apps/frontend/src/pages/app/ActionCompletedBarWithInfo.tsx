import CompletedBar from "../../components/CompletedBar";
import UserProfilePicRow from "../../components/UserProfilePicRow";
import InfoTooltip from "../../components/InfoTooltip";
import {
  ActionCompletedBarWithInfoPropsShared,
  getCompletedPercentage,
} from "@alliance/shared/lib/actionCompletedBarWithInfo";

interface ActionCompletedBarWithInfoProps
  extends ActionCompletedBarWithInfoPropsShared {
  className?: string;
  textSize?: "sm" | "base";
  textColor?: string;
  showInfoTooltip?: boolean;
}

const ActionCompletedBarWithInfo: React.FC<ActionCompletedBarWithInfoProps> = ({
  action,
  friendActivities,
  className,
  textSize = "sm",
  textColor = "zinc-500",
  showInfoTooltip = false,
}: ActionCompletedBarWithInfoProps) => {
  const { labelString, percentage } = getCompletedPercentage(action);

  if (percentage === null) {
    return null;
  }

  return (
    <div className={`${className}`}>
      <div className="flex flex-row items-center justify-between w-full gap-x-2">
        <div className="flex flex-row items-center gap-x-2 mb-1">
          <p className={`text-${textSize} text-${textColor}`}>
            {labelString}{" "}
            {action.status === "gathering_commitments"
              ? "members committed"
              : "members completed"}
          </p>
          {showInfoTooltip && (
            <InfoTooltip
              content={
                <p>
                  The denominator is the number of members expected to
                  complete this action. Sometimes, different members are
                  expected to complete different actions, or may have marked
                  themselves as &quot;Away&quot; in settings.
                </p>
              }
            />
          )}
        </div>
        {friendActivities !== null && (
          <UserProfilePicRow
            users={friendActivities.map((activity) => activity.user)}
          />
        )}
      </div>
      <CompletedBar percentage={percentage} />
    </div>
  );
};

export default ActionCompletedBarWithInfo;
