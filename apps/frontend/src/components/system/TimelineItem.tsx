import { ActionDto, ActionEventDto } from "@alliance/shared/client";
import ActionCompletedBarWithInfo from "../../pages/app/ActionCompletedBarWithInfo";
import { cn } from "@alliance/shared/styles/util";
import { readableActionStatus } from "@alliance/shared/lib/actionStatus";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { formatDistance } from "date-fns";

interface TimelineItemProps {
  event: ActionEventDto;
  action: ActionDto;
  highlighted?: boolean;
}

/**
 * A demoted status-change marker in the action timeline: a quiet kicker (the
 * status label) + time, with the organizer-written title as a small line.
 * Updates are rendered separately as the headline dispatches.
 */
const TimelineItem: React.FC<TimelineItemProps> = ({
  event,
  action,
  highlighted = false,
}: TimelineItemProps) => {
  const { activities: friendActivities } = useActivities({
    list: ActivityList.FriendsForAction,
    objectId: action.id,
    comments: false,
    limit: 8,
  });

  // Show the organizer-written title (e.g. "Action completed"); fall back to the
  // status label only if the event has no title.
  const label = event.title.trim() || readableActionStatus[event.newStatus];
  const showCompletedBar =
    event.newStatus === "member_action" && action.status !== "member_action";

  return (
    <div className="flex flex-col gap-y-1.5">
      {showCompletedBar && (
        <div className="mt-5 mb-6 mx-1">
          <ActionCompletedBarWithInfo
            friendActivities={friendActivities}
            action={action}
            textSize="base"
            textColor="zinc-800"
            showInfoTooltip
            seeAllLink
            dark
          />
        </div>
      )}
      <div className="flex items-baseline gap-x-3 text-sm">
        <span
          className={cn(
            "font-semibold",
            highlighted ? "text-green" : "text-zinc-400",
          )}
        >
          {label}
        </span>
        <span className="ml-auto shrink-0 whitespace-nowrap font-medium text-zinc-400">
          {formatDistance(event.date, new Date(), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
};

export default TimelineItem;
