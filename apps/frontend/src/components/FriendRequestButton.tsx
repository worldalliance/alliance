import { FriendStatusDto } from "@alliance/shared/client";
import Button from "./system/Button";
import icons8Plus from "../assets/icons8-plus.svg";
import { ButtonColor } from "./system/Button";
import { useState } from "react";

interface FriendRequestButtonProps {
  friendStatus: FriendStatusDto["status"];
  handleSendFriendRequest: () => void;
  handleRemoveFriend: () => void;
}

const FriendRequestButton = ({
  friendStatus,
  handleSendFriendRequest,
  handleRemoveFriend,
}: FriendRequestButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);

  if (friendStatus === "none") {
    return (
      <Button
        color={ButtonColor.Blue}
        onClick={handleSendFriendRequest}
        className="rounded-full pl-3"
      >
        <img src={icons8Plus} alt="send" className="invert w-6 h-6" />
        <span>Send Friend Request</span>
      </Button>
    );
  }
  if (friendStatus === "pending") {
    return (
      <Button
        color={ButtonColor.Light}
        onClick={handleSendFriendRequest}
        className="rounded-full"
      >
        <span>Request sent!</span>
      </Button>
    );
  }
  return (
    <Button
      color={isHovered ? ButtonColor.Red : ButtonColor.Green}
      onClick={handleRemoveFriend}
      className={`min-w-36`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered ? "  Remove Friend  " : "You are friends!"}
    </Button>
  );
};

export default FriendRequestButton;
