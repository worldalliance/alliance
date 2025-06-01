import { ActionWithRelationDto } from "@alliance/shared/client";
import { CardStyle } from "./system/Card";
import Card from "./system/Card";
import Badge from "./system/Badge";
import { formatDistanceToNow } from "date-fns";

interface UserActivityCardProps {
  action: ActionWithRelationDto;
}

const UserActivityCard = ({ action }: UserActivityCardProps) => {
  const timeSinceCompleted = formatDistanceToNow(
    new Date(action.relation.dateCompleted),
    {
      addSuffix: true,
    }
  );

  return (
    <div className="flex flex-row justify-stretch items-center space-x-4">
      <Card
        className="block bg-pagebg text-[11pt] font-avenir flex-1 border-b"
        style={CardStyle.White}
      >
        <div className="flex items-center justify-start w-[100%] space-x-3">
          <Badge className="!bg-[#5d9c2d]">
            Completed {action.relation.dateCompleted ? timeSinceCompleted : ""}
          </Badge>
          <p className="font-bold">{action.name}</p>
        </div>
        <div className="flex items-center justify-between ">
          <p>{action.description}</p>
        </div>
      </Card>
    </div>
  );
};

export default UserActivityCard;
