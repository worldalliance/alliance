import { ActionDto } from "@alliance/shared/client";
import Card, { CardStyle } from "./system/Card";

export interface ActionTaskPanelFundingProps {
  action: ActionDto;
}

const ActionTaskPanelFunding = ({ action }: ActionTaskPanelFundingProps) => {
  return (
    <Card style={CardStyle.Outline}>
      <h2>Give $5</h2>
      <p>{action.shortDescription}</p>
    </Card>
  );
};

export default ActionTaskPanelFunding;
