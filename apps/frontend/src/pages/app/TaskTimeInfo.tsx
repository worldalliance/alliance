import { withCount } from "@alliance/common/plural";
import {
  deadlineColor,
  formatDeadline,
  TaskTimeInfoPropsShared,
} from "@alliance/shared/lib/taskTimeInfo";
import { formatTime } from "@alliance/shared/lib/utils";
import { CalendarCheck, Clock } from "lucide-react";

const TaskTimeInfo = ({
  action,
  nextEvent,
  absoluteDeadline = false,
}: TaskTimeInfoPropsShared) => {
  const color = deadlineColor(nextEvent, action);

  return (
    <div className="flex flex-row flex-wrap gap-x-4">
      {!!action.timeEstimate && (
        <div className="flex flex-row items-center gap-x-1.5 text-base text-zinc-500">
          <Clock className="h-4 w-4 text-green" aria-label="Clock" />
          <p className="text-green">
            {withCount(action.timeEstimate, "minute")}
          </p>
        </div>
      )}
      {!!nextEvent && (
        <div className="flex flex-row items-center gap-x-1.5 text-base group text-zinc-500">
          <CalendarCheck
            className="h-4 w-4"
            color={color}
            aria-label="Deadline"
          />
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
