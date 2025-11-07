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
        className=""
      >
        <span>Send Friend Request</span>
      </Button>
    );
  }
  if (friendStatus.status === "pending") {
    if (friendStatus.didReceiveRequest) {
      return (
        <div className="flex flex-row gap-x-3 items-center text-sm">
          <p>Sent you a friend request</p>
          <Button color={ButtonColor.Green} onClick={handleAcceptFriendRequest}>
            Accept
          </Button>
        </div>
      );
    }
    return (
      <Button color={ButtonColor.Light} onClick={handleSendFriendRequest}>
        <span>Request sent!</span>
      </Button>
    );
  }
  return (
    <Button
      color={isHovered ? ButtonColor.RedOutline : ButtonColor.GreenOutLine}
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
