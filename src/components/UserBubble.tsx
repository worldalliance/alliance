import { PropsWithChildren } from "react";
import userImage from "../assets/icons8-user-80.png";

interface UserBubbleProps extends PropsWithChildren {
  className?: string;
  clipped?: boolean;
}

const UserBubble: React.FC<UserBubbleProps> = ({
  children,
  className,
  clipped = false,
}) => {
  return (
    <div
      className={`rounded-full bg-gray-200 overflow-hidden ${
        clipped
          ? "mr-[-25px] border border-[5px] border-stone-50"
          : "border border-[5px] border-stone-50"
      } ${className}`}
    >
      <img
        src={userImage}
        alt="user"
        className="w-[40px] h-[40px]  mt-1"
        style={{ boxSizing: "border-box" }}
      />
    </div>
  );
};

export default UserBubble;
