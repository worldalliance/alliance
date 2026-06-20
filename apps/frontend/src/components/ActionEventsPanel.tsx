import { ActionDto, ActionEventDto } from "@alliance/shared/client";
import {
  processActionDispatches,
  DispatchEntry,
} from "@alliance/shared/lib/actionEventsPanel";
import Timeline from "./system/Timeline";
import TimelineItem from "./system/TimelineItem";
import ActionUpdateCard from "@alliance/sharedweb/ui/ActionUpdateCard";

export interface ActionEventsPanelProps {
  action: ActionDto;
}

type UpdateEntry = Extract<DispatchEntry, { kind: "update" }>;

// A run of consecutive status markers renders as one tight cluster; updates each
// render on their own. `index` is the entry's position in the full feed, used to
// flag the highlighted (latest) entry.
type RenderGroup =
  | { type: "update"; index: number; entry: UpdateEntry }
  | { type: "statuses"; items: { index: number; event: ActionEventDto }[] };

const ActionEventsPanel = ({ action }: ActionEventsPanelProps) => {
  const { entries, highlightedIndex } = processActionDispatches(action);

  // Fold consecutive status entries together so a run of them is a single Timeline
  // child (one hairline + padding) instead of several thin floating rows.
  const groups: RenderGroup[] = [];
  entries.forEach((entry, index) => {
    if (entry.kind === "status") {
      const last = groups[groups.length - 1];
      if (last?.type === "statuses") {
        last.items.push({ index, event: entry.event });
      } else {
        groups.push({ type: "statuses", items: [{ index, event: entry.event }] });
      }
    } else {
      groups.push({ type: "update", index, entry });
    }
  });

  const nodes = groups.map((group) => {
    switch (group.type) {
      case "update":
        return (
          <ActionUpdateCard
            key={`u-${group.entry.update.id}`}
            update={group.entry.update}
            status={group.entry.status}
            highlighted={group.index === highlightedIndex}
            plain
          />
        );
      case "statuses":
        return (
          <div
            key={`s-${group.items[0].event.id}`}
            className="flex flex-col gap-y-2"
          >
            {group.items.map((item) => (
              <TimelineItem
                key={item.event.id}
                event={item.event}
                action={action}
                highlighted={item.index === highlightedIndex}
              />
            ))}
          </div>
        );
      default:
        return group satisfies never;
    }
  });

  // Draw a divider only between two updates — never around a status marker.
  const dividers = groups.map(
    (group, i) =>
      i > 0 && group.type === "update" && groups[i - 1].type === "update",
  );

  return entries.length > 0 ? (
    <div className="flex flex-col w-full">
      <Timeline dividers={dividers}>{nodes}</Timeline>
    </div>
  ) : null;
};

export default ActionEventsPanel;
