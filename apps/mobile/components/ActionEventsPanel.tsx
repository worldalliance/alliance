import { formatDistance } from "date-fns";
import { View } from "react-native";
import { ActionDto } from "../../../shared/client";
import {
  isActionEvent,
  processActionTimeline,
} from "../../../shared/lib/actionEventsPanel";
import ActionUpdateCard from "./ActionUpdateCard";
import Timeline from "./system/Timeline";
import TimelineItem from "./system/TimelineItem";

export interface ActionEventsPanelProps {
  action: ActionDto;
}

export default function ActionEventsPanel({ action }: ActionEventsPanelProps) {
  const { interleaved, highlightedId, highlightedIndex } =
    processActionTimeline(action);

  if (interleaved.length === 0) {
    return null;
  }

  return (
    <View className="flex flex-col w-full">
      <Timeline currentIdx={highlightedIndex}>
        {interleaved.map((item) =>
          isActionEvent(item) ? (
            <TimelineItem
              key={`event-${item.id}`}
              title={item.title}
              description={item.description}
              highlighted={item.id === highlightedId}
              time={formatDistance(new Date(item.date), new Date(), {
                addSuffix: true,
              })}
              updates={item.updates}
            />
          ) : (
            <ActionUpdateCard key={`update-${item.id}`} update={item} />
          ),
        )}
      </Timeline>
    </View>
  );
}
