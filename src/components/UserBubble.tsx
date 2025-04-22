import { PropsWithChildren } from "react";
import userImage from "../assets/icons8-user-80.png";

interface UserBubbleProps extends PropsWithChildren {
  className?: string;
}

const UserBubble: React.FC<UserBubbleProps> = ({ children, className }) => {
  return (
    <div className="rounded-full bg-gray-200 w-[50px] h-[50px] overflow-hidden">
      <img src={userImage} alt="user" className="w-[50px] h-[50px] mt-1" />
    </div>
  );
};

export default UserBubble;
