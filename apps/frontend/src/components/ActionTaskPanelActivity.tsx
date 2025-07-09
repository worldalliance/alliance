import ReactMarkdown from "react-markdown";
import Button from "./system/Button";
import Card, { CardStyle } from "./system/Card";
import { ActionDto } from "@alliance/shared/client";

interface ActionTaskPanelActivityProps {
  action: ActionDto;
  onCompleteAction: () => void;
}

const ActionTaskPanelActivity = ({
  action,
  onCompleteAction,
}: ActionTaskPanelActivityProps) => {
  return (
    <Card style={CardStyle.White}>
      <div className="flex flex-col gap-y-2">
        <p className="font-bold">This action is awaiting your completion</p>
        <ReactMarkdown>{action.taskContents}</ReactMarkdown>
        <div className="flex justify-end">
          <Button onClick={onCompleteAction}>Mark Complete</Button>
        </div>
      </div>
    </Card>
  );
};

export default ActionTaskPanelActivity;
