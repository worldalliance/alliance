import ActionUpdatesTab from "../../../components/ActionUpdatesTab";
import type { TaskTabProps } from "../taskTabs";

export function MessagesTab({ task, lookups }: TaskTabProps) {
  return (
    <ActionUpdatesTab
      actionId={task.id}
      updates={task.updates ?? []}
      events={task.events ?? []}
      availableTags={lookups.availableTags}
    />
  );
}
