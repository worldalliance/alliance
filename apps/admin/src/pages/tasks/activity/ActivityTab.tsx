import ActionCohortDecisionsTab from "../../../components/ActionCohortDecisionsTab";
import type { TaskTabProps } from "../taskTabs";

export function ActivityTab({ task }: TaskTabProps) {
  return <ActionCohortDecisionsTab actionId={task.id} />;
}
