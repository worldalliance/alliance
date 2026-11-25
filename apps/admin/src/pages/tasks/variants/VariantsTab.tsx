import ActionFormVariantsTab from "../../../components/ActionFormVariantsTab";
import type { TaskTabProps } from "../taskTabs";

export function VariantsTab({ task }: TaskTabProps) {
  return <ActionFormVariantsTab action={task} />;
}
