import { ActionDto, UserDto } from "@alliance/shared/client";

interface UserActivityCardProps {
  action: ActionDto;
}

const UserActivityCard = ({ action }: UserActivityCardProps) => {
  return <div>UserActivityCard</div>;
};

export default UserActivityCard;
