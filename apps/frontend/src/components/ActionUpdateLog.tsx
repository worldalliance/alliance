import { ActionDto } from "@alliance/shared/client";

export interface ActionUpdateLogProps {
  action: ActionDto;
}

const ActionUpdateLog = ({ action }: ActionUpdateLogProps) => {
  return <div>ActionUpdateLog</div>;
};

export default ActionUpdateLog;
