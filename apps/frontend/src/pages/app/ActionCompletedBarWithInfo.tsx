import {
  ActionActivityDto,
  ActionDto,
} from "@alliance/shared/client/types.gen";
import CompletedBar from "../../components/CompletedBar";
import UserProfilePicRow from "../../components/UserProfilePicRow";

interface ActionCompletedBarWithInfoProps {
  friendActivities: ActionActivityDto[] | null;
  className?: string;
  textSize?: "sm" | "base";
  textColor?: string;
  action: Pick<
    ActionDto,
    | "commitmentThreshold"
    | "status"
    | "everyoneShouldComplete"
    | "usersCompleted"
    | "usersJoined"
  >;
}

const ActionCompletedBarWithInfo: React.FC<ActionCompletedBarWithInfoProps> = ({
  action,
  friendActivities,
  className,
  textSize = "sm",
  textColor = "zinc-500",
}: ActionCompletedBarWithInfoProps) => {
  const value =
    action.status === "member_action"
      ? action.usersCompleted
      : action.usersJoined;

  const threshold =
    action.status === "gathering_commitments"
      ? action.commitmentThreshold
      : action.usersJoined;

  if (!threshold) {
    return null;
  }

  const safeThreshold = Math.max(threshold, value);
  return (
    <div className={`${className}`}>
      <div className="flex flex-row items-center justify-between w-full gap-x-2">
        <p className={`mb-1 text-${textSize} text-${textColor}`}>
          {value} / {safeThreshold}{" "}
          {action.status === "gathering_commitments"
            ? "members committed"
            : "members completed"}
        </p>
        {friendActivities !== null && (
          <UserProfilePicRow
            users={friendActivities.map((activity) => activity.user)}
          />
        )}
      </div>
      <CompletedBar percentage={(value / safeThreshold) * 100} />
    </div>
  );
};

export default ActionCompletedBarWithInfo;
