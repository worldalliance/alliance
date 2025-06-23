import { ActionDto, UserActionDto } from "@alliance/shared/client";
import ActionTaskPanelFunding from "./ActionTaskPanelFunding";
import { StripeWrapper } from "./StripeWrapper";
import ActionTaskPanelCompleted from "./ActionTaskPanelCompleted";

export interface ActionTaskPanelProps {
  action: ActionDto;
  userRelation: UserActionDto["status"] | null;
}
const ActionTaskPanel = ({ action, userRelation }: ActionTaskPanelProps) => {
  if (userRelation === "completed") {
    return <ActionTaskPanelCompleted />;
  }

  if (action.type === "Funding") {
    return (
      <StripeWrapper>
        <ActionTaskPanelFunding action={action} />
      </StripeWrapper>
    );
  }
  return null;
};

export default ActionTaskPanel;
