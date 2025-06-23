import { ActionDto } from "@alliance/shared/client";
import Card, { CardStyle } from "./system/Card";

export interface ActionTaskPanelCompletedProps {
  action: ActionDto;
}

const ActionTaskPanelCompleted = () => {
  return (
    <Card style={CardStyle.Green}>
      <p className="font-bold pt-1">
        We&apos;ve recieved your contribution! Thanks for helping.
      </p>
    </Card>
  );
};

export default ActionTaskPanelCompleted;
