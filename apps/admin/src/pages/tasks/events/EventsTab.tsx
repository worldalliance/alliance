import EventManagementTab from "../../../components/EventManagementTab";
import type { TaskTabProps } from "../taskTabs";

export function EventsTab({ task, admin }: TaskTabProps) {
  return <EventManagementTab action={task} addEvent={admin.addEvent} />;
}
