import { ActionEventDto } from "@alliance/shared/client/types.gen";
import { ActionDto } from "@alliance/shared/client/types.gen";
import { formatTime } from "@alliance/shared/lib/utils";
import ClockIcon from "@alliance/shared/ui/icons/ClockIcon";
import DeadlineIcon from "@alliance/shared/ui/icons/DeadlineIcon";

export interface TaskTimeInfoProps {
  action: ActionDto;
  nextEvent: ActionEventDto | null;
  lastEvent: ActionEventDto | null;
}

const TaskTimeInfo = ({ action, nextEvent, lastEvent }: TaskTimeInfoProps) => {
  const deadlineColor =
    !!nextEvent && new Date(nextEvent.date).getTime() - Date.now() < 172800000 // 2 days
      ? "var(--color-red-600)"
      : "var(--color-zinc-500)";

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
        <div className="flex flex-row items-center gap-x-1.5 text-base text-zinc-500">
          <DeadlineIcon fill={deadlineColor} />
          <p style={{ color: deadlineColor }}>
            {`${formatTime(new Date(nextEvent.date), {
              addSuffix: false,
            })}`}{" "}
            left
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskTimeInfo;
