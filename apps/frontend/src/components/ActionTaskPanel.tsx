import { ActionDto, UserActionDto } from "@alliance/shared/client";
import ActionTaskPanelFunding from "./ActionTaskPanelFunding";
import { StripeWrapper } from "./StripeWrapper";
import ActionTaskPanelCompleted from "./ActionTaskPanelCompleted";

export interface ActionTaskPanelProps {
  action: ActionDto;
  userRelation: UserActionDto["status"] | null;
  onCompleteAction: () => void;
}
const ActionTaskPanel = ({
  action,
  userRelation,
  onCompleteAction,
}: ActionTaskPanelProps) => {
  if (userRelation === "completed") {
    return <ActionTaskPanelCompleted />;
  }

  if (action.type === "Funding") {
    return (
      <StripeWrapper actionId={action.id}>
        <ActionTaskPanelFunding onPaymentSuccess={onCompleteAction} />
      </StripeWrapper>
    );
  }
  return null;
};

export default ActionTaskPanel;
