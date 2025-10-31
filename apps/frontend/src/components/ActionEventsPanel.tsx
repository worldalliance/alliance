import { ActionDto } from "@alliance/shared/client";
import { formatDistance } from "date-fns";
import Timeline from "./system/Timeline";
import TimelineItem from "./system/TimelineItem";
import ActionCompletedBarWithInfo from "../pages/app/ActionCompletedBarWithInfo";
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
      <p className="font-semibold font-serif text-xl text-black">Status</p>
      <Timeline>
        {pastEvents
          .slice()
          .reverse()
          .map((event, idx) => (
            <Fragment key={event.id}>
              <TimelineItem
                title={event.title}
                description={event.description}
                first={idx === 0}
                time={formatDistance(event.date, new Date(), {
                  addSuffix: true,
                })}
              />
              <ActionCompletedBarWithInfo
                action={{ ...action, status: event.newStatus }}
                friendActivities={null}
                className="mt-4"
              />
            </Fragment>
          ))}
      </Timeline>
    </div>
  );
};

export default ActionEventsPanel;
