import { ActionWithRelationDto } from "@alliance/shared/client";
import { CardStyle } from "./system/Card";
import Card from "./system/Card";
import Badge from "./system/Badge";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router";
import { useCallback } from "react";

interface UserActivityCardProps {
  action: ActionWithRelationDto;
}

const UserActivityCard = ({ action }: UserActivityCardProps) => {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    navigate(`/actions/${action.id}`);
  }, [action.id, navigate]);

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
        onClick={handleClick}
      >
        <div className="flex items-center justify-start w-[100%] space-x-3">
          <Badge className="!bg-[#5d9c2d] text-white">
            Completed {action.relation.dateCompleted ? timeSinceCompleted : ""}
          </Badge>
          <p className="font-bold">{action.name}</p>
        </div>
        <div className="flex items-center justify-between ">
          <p>{action.shortDescription}</p>
        </div>
      </Card>
    </div>
  );
};

export default UserActivityCard;
