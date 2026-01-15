import {
  deadlineColor,
  formatDeadline,
  TaskTimeInfoPropsShared,
} from "@alliance/shared/lib/taskTimeInfo";
import { formatTime } from "@alliance/shared/lib/utils";
import ClockIcon from "@alliance/sharedweb/ui/icons/ClockIcon";
import DeadlineIcon from "@alliance/sharedweb/ui/icons/DeadlineIcon";

const TaskTimeInfo = ({
  action,
  nextEvent,
  absoluteDeadline = false,
}: TaskTimeInfoPropsShared) => {
  const color = deadlineColor(nextEvent, action);

  return (
    <div className="flex flex-row flex-wrap gap-x-4">
      {!!action.timeEstimate && action.status !== "gathering_commitments" && (
        <div className="flex flex-row items-center gap-x-1.5 text-base text-zinc-500">
          <ClockIcon />
          <p className="text-green">{`${action.timeEstimate} minute${
            action.timeEstimate === 1 ? "" : "s"
          }`}</p>
        </div>
      )}
      {!!nextEvent && (
        <div className="flex flex-row items-center gap-x-1.5 text-base group text-zinc-500">
          <DeadlineIcon fill={color} />
          {absoluteDeadline ? (
            <p className="text-zinc-500">
              Due {formatDeadline(nextEvent.date)} (
              {`${formatTime(new Date(nextEvent.date), {
                addSuffix: false,
              })}`}{" "}
              left)
            </p>
          ) : (
            <p style={{ color: color }}>
              {`${formatTime(new Date(nextEvent.date), {
                addSuffix: false,
              })}`}{" "}
              left
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskTimeInfo;
