import { ActionDto } from "@alliance/shared/client";
import {
  processActionTimeline,
  isActionEvent,
} from "@alliance/shared/lib/actionEventsPanel";
import { formatDistance } from "date-fns";
import Timeline from "./system/Timeline";
import TimelineItem from "./system/TimelineItem";
import { Fragment } from "react";
import ActionUpdateCard from "@alliance/sharedweb/ui/ActionUpdateCard";

export interface ActionEventsPanelProps {
  action: ActionDto;
}

const ActionEventsPanel = ({ action }: ActionEventsPanelProps) => {
  const { interleaved, highlightedId, highlightedIndex } =
    processActionTimeline(action);

  return interleaved.length > 0 ? (
    <div className="flex flex-col w-full">
      <p className="text-title-small mb-4">Timeline</p>
      <Timeline currentIdx={highlightedIndex}>
        {interleaved.map((item) => (
          <Fragment key={item.id}>
            {isActionEvent(item) ? (
              <TimelineItem
                title={item.title}
                showCompletedBar={
                  item.newStatus === "member_action" &&
                  action.status !== "member_action"
                }
                action={action}
                description={item.description}
                highlighted={item.id === highlightedId}
                time={formatDistance(item.date, new Date(), {
                  addSuffix: true,
                })}
                updates={item.updates}
              />
            ) : (
              <ActionUpdateCard key={item.id} update={item} />
            )}
          </Fragment>
        ))}
      </Timeline>
    </div>
  ) : null;
};

export default ActionEventsPanel;
