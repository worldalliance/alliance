import { ActionDto } from "@alliance/shared/client";
import ActionTaskPanelFunding from "./ActionTaskPanelFunding";

export interface ActionTaskPanelProps {
  action: ActionDto;
}
const ActionTaskPanel = ({ action }: ActionTaskPanelProps) => {
  if (action.type === "Funding") {
    return <ActionTaskPanelFunding action={action} />;
  }
  return null;
};

export default ActionTaskPanel;
