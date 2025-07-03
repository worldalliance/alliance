import { ActionDto } from "@alliance/shared/client";
import Timeline from "./system/Timeline";
import TimelineItem from "./system/TimelineItem";
import { formatDistance } from "date-fns";

export interface ActionEventsPanelProps {
  events: ActionDto["events"];
}

const ActionEventsPanel = ({ events }: ActionEventsPanelProps) => {
  return (
    <div className="flex flex-col gap-y-3 p-2">
      <p className="text-lg font-bold">Timeline</p>
      <Timeline>
        {events.map((event) => (
          <TimelineItem
            key={event.id}
            title={event.title}
            description={event.description}
            time={formatDistance(event.date, new Date(), {
              addSuffix: true,
            })}
          />
        ))}
      </Timeline>
    </div>
  );
};

export default ActionEventsPanel;
