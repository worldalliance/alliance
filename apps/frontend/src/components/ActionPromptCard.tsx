import { useNavigate } from "react-router-dom";
import Card, { CardStyle } from "./system/Card";
import { Status } from "./StatusIndicator";
import StatusIndicator from "./StatusIndicator";

export interface ActionPromptCardProps {
  title: string;
  description: string;
  category: string;
  id: string;
}

const ActionPromptCard: React.FC<ActionPromptCardProps> = ({
  title,
  description,
  id,
}) => {
  const navigate = useNavigate();

  return (
    <div className="relative">
      <StatusIndicator status={Status.New} />
      <Card
        style={CardStyle.Alert}
        className="block space-y-2 font-avenir"
        onClick={() => {
          navigate(`/action/${id}`);
        }}
      >
        <div className="flex items-center justify-start w-[100%] space-x-3">
          <p className="font-bold">Commit to a new action: {title}</p>
        </div>
        <div className="flex items-center justify-between ">
          <p>{description}</p>
        </div>
      </Card>
    </div>
  );
};

export default ActionPromptCard;
