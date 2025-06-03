import { ActionDto } from "@alliance/shared/client";

export interface ActionProgressBarProps {
  action: ActionDto;
}

const ActionProgressBar = ({ action }: ActionProgressBarProps) => {
  return <div>ActionProgressBar</div>;
};

export default ActionProgressBar;
