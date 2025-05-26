import { ActionDto, UserDto } from "@alliance/shared/client";
import { CardStyle } from "../../components/system/Card";
import Card from "../../components/system/Card";
import Badge from "../../components/system/Badge";

interface UserActivityCardProps {
  action: ActionDto;
}

const UserActivityCard = ({ action }: UserActivityCardProps) => {
  return (
    <div className="flex flex-row justify-stretch items-center space-x-4">
      <p className="text-stone-500 text-sm">2 days ago</p>
      <Card
        className="block bg-pagebg text-[11pt] font-avenir flex-1"
        style={CardStyle.White}
      >
        <div className="flex items-center justify-start w-[100%] space-x-3">
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
