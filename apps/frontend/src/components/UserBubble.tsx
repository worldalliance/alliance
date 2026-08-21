import { cn } from "@alliance/shared/styles/util";
import { PropsWithChildren } from "react";
import userImage from "../assets/icons8-user-80.png";

interface UserBubbleProps extends PropsWithChildren {
  className?: string;
  clipped?: boolean;
  bgColor?: string;
  image?: string;
}

const UserBubble: React.FC<UserBubbleProps> = ({
  className,
  clipped = false,
  image,
}: UserBubbleProps) => {
  return (
    <div
      className={cn(
        "border rounded-full bg-gray-200 overflow-hidden",
        clipped ? "mr-[-25px] border-zinc-50" : " border-zinc-50",
        className,
      )}
    >
      <img
        src={image ?? userImage}
        alt="user"
        className="w-full h-full object-cover"
        style={{ boxSizing: "border-box" }}
      />
    </div>
  );
};

export default UserBubble;
