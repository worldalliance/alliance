import ActionMergedResponsesTab from "../../../components/ActionMergedResponsesTab";
import type { TaskTabProps } from "../taskTabs";

export function ResponsesTab({ task }: TaskTabProps) {
  return <ActionMergedResponsesTab actionId={task.id} paramNamespace="resp" />;
}
