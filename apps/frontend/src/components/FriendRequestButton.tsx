import { FriendStatusDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useState } from "react";

interface FriendRequestButtonProps {
  friendStatus: FriendStatusDto | null;
  handleSendFriendRequest: () => void;
  handleRemoveFriend: () => void;
  handleAcceptFriendRequest: () => void;
}

const FriendRequestButton = ({
  friendStatus,
  handleSendFriendRequest,
  handleRemoveFriend,
  handleAcceptFriendRequest,
}: FriendRequestButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);

  if (!friendStatus || friendStatus.status === "none") {
    return (
      <Button
        color={ButtonColor.BlueOutline}
        onClick={handleSendFriendRequest}
        className="!h-9"
      >
        <span>Send friend request</span>
      </Button>
    );
  }
  if (friendStatus.status === "pending") {
    if (friendStatus.didReceiveRequest) {
      return (
        <div className="flex flex-row gap-x-3 items-center text-sm">
          <p>Sent you a friend request</p>
          <Button
            color={ButtonColor.Green}
            onClick={handleAcceptFriendRequest}
            className="!h-9"
          >
            Accept
          </Button>
        </div>
      );
    }
    return (
      <Button
        color={ButtonColor.Light}
        onClick={handleSendFriendRequest}
        className="!h-9"
      >
        <span>Friend request sent</span>
      </Button>
    );
  }
  return (
    <Button
      color={isHovered ? ButtonColor.RedOutline : ButtonColor.White}
      onClick={handleRemoveFriend}
      className={`!h-9 transition-all duration-100`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered ? "  Remove friend  " : "Friends"}
    </Button>
  );
};

export default FriendRequestButton;
