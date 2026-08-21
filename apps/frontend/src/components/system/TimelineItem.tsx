import { ActionDto, ActionUpdateDto } from "@alliance/shared/client";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import ActionUpdateCard from "@alliance/sharedweb/ui/ActionUpdateCard";
import Card from "@alliance/sharedweb/ui/Card";
import ActionCompletedBarWithInfo from "../../pages/app/ActionCompletedBarWithInfo";

interface TimelineItemProps {
  highlighted?: boolean;
  title?: string;
  description: string;
  action: ActionDto;
  showCompletedBar?: boolean;
  updates?: ActionUpdateDto[];
  time?: string;
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  highlighted = false,
  title,
  description,
  action,
  showCompletedBar = false,
  updates,
  time,
}: TimelineItemProps) => {
  const sortedUpdates = [...(updates ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const { activities: friendActivities } = useActivities({
    list: ActivityList.FriendsForAction,
    objectId: action.id,
    comments: false,
    limit: 8,
  });

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-row items-center gap-x-2 mt-px">
        <p
          className={cn(
            "font-medium",
            highlighted ? "text-green" : "text-black",
          )}
        >
          {title}
        </p>
        <p className="text-zinc-500">{time}</p>
      </div>
      {description && (
        <p className="mt-1 text-zinc-500 text-sm">{description}</p>
      )}
      {showCompletedBar && (
        <Card style={CardStyle.WhiteBorder} className="p-6 mt-2">
          <ActionCompletedBarWithInfo
            friendActivities={friendActivities}
            action={action}
            textSize="base"
            textColor="zinc-800"
            showInfoTooltip
            seeAllLink
            dark
          />
        </Card>
      )}
      {updates && updates.length > 0 && (
        <div className="flex flex-col gap-y-1.5 mt-2">
          {sortedUpdates?.map((update) => (
            <ActionUpdateCard key={update.id} update={update} border />
          ))}
        </div>
      )}
    </div>
  );
};

export default TimelineItem;
