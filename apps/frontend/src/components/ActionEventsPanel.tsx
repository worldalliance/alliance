import { ActionDto } from "@alliance/shared/client";
import { format, formatDistance } from "date-fns";
import Timeline from "./system/Timeline";
import TimelineItem from "./system/TimelineItem";
import { Fragment } from "react";

export interface ActionEventsPanelProps {
  action: ActionDto;
  events: ActionDto["events"];
}

const ActionEventsPanel = ({ action, events }: ActionEventsPanelProps) => {
  const pastEvents = events
    .filter((event) => new Date(event.date) < new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (action.status === "draft" && events.length === 0) {
    pastEvents.push({
      id: 0,
      title: "Draft",
      description: "This action is being viewed as a draft preview",
      date: new Date().toISOString(),
      newStatus: "draft",
      showInTimeline: true,
      suiteManaged: false,
    });
  }

  return (
    <div className="flex flex-col gap-y-3 w-full">
      <Timeline>
        {events
          .slice()
          .reverse()
          .map((event, idx) => (
            <Fragment key={event.id}>
              <TimelineItem
                title={event.title}
                description={event.description}
                first={idx === 0}
                absoluteTime={format(event.date, "h:mm a MMM d")}
                time={formatDistance(event.date, new Date(), {
                  addSuffix: true,
                })}
              />
            </Fragment>
          ))}
      </Timeline>
    </div>
  );
};

export default ActionEventsPanel;
