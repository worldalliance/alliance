import {
  ActionDto,
  ActionEventDto,
  ActionUpdateDto,
} from "@alliance/shared/client";
import { formatDistance } from "date-fns";
import Timeline from "./system/Timeline";
import TimelineItem from "./system/TimelineItem";
import { Fragment } from "react";
import ActionUpdateCard from "@alliance/shared/ui/ActionUpdateCard";

export interface ActionEventsPanelProps {
  action: ActionDto;
}

type ActionEventWithUpdates = ActionEventDto & {
  updates?: ActionUpdateDto[];
};

const ActionEventsPanel = ({ action }: ActionEventsPanelProps) => {
  const events =
    action.events.length > 1
      ? action.events.filter((event) => event.newStatus !== "planned")
      : action.events;
  const updates = action.updates;

  if (action.status === "draft" && events.length === 0) {
    events.push({
      id: 0,
      title: "Draft",
      description: "This action is being viewed as a draft preview",
      date: new Date().toISOString(),
      newStatus: "draft",
      suiteManaged: false,
    });
  }

  const eventsWithUpdates: ActionEventWithUpdates[] = events.map((event) => {
    return {
      ...event,
      updates: updates.filter(
        (update) =>
          update.associatedEventId !== undefined &&
          update.associatedEventId === event.id &&
          new Date(update.date).getTime() <= new Date().getTime() // don't show future updates
      ),
    } as ActionEventWithUpdates;
  });

  const updatesWithoutEvents = updates.filter(
    (update) => !update.associatedEventId
  );

  const interleaved: (ActionEventWithUpdates | ActionUpdateDto)[] = [
    ...eventsWithUpdates,
    ...updatesWithoutEvents.filter(
      (update) => new Date(update.date).getTime() <= new Date().getTime() // don't show future updates
    ),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // always use the latest event/update that isn't in the future
  const highlightedObjectIndex = interleaved.findIndex((e) => {
    const eventDate = new Date(e.date).getTime();
    const now = new Date().getTime();
    return eventDate <= now;
  });
  const highlightedObjectId =
    highlightedObjectIndex !== -1
      ? interleaved[highlightedObjectIndex].id
      : undefined;

  return events.length > 0 ? (
    <div className="flex flex-col w-full">
      <Timeline currentIdx={highlightedObjectIndex}>
        {interleaved.slice().map((event) => (
          <Fragment key={event.id}>
            {"newStatus" in event ? (
              <TimelineItem
                title={event.title}
                description={event.description}
                highlighted={event.id === highlightedObjectId}
                time={formatDistance(event.date, new Date(), {
                  addSuffix: true,
                })}
                updates={event.updates}
              />
            ) : (
              <ActionUpdateCard key={event.id} update={event} />
            )}
          </Fragment>
        ))}
      </Timeline>
    </div>
  ) : null;
};

export default ActionEventsPanel;
