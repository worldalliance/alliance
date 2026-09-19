import { FriendStatusDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useState } from "react";

interface FriendRequestButtonProps {
  friendStatus: FriendStatusDto | null;
  handleSendFriendRequest: () => void;
  handleRemoveFriend: (e: React.MouseEvent<HTMLElement>) => void;
  handleAcceptFriendRequest: () => void;
  accepting: boolean;
}

const FriendRequestButton = ({
  friendStatus,
  handleSendFriendRequest,
  handleRemoveFriend,
  handleAcceptFriendRequest,
  accepting,
}: FriendRequestButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const status = friendStatus?.status ?? "none";
  switch (status) {
    case "none":
    case "declined":
      return (
        <Button
          color={ButtonColor.BlueOutline}
          onClick={handleSendFriendRequest}
          className="!h-9"
        >
          <span>Send friend request</span>
        </Button>
      );
    case "pending":
      if (friendStatus?.didReceiveRequest) {
        return (
          <div className="flex flex-row gap-x-3 items-center text-sm">
            <p>Sent you a friend request</p>
            <Button
              color={ButtonColor.Green}
              onClick={handleAcceptFriendRequest}
              disabled={accepting}
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
    case "accepted":
      return (
        <Button
          color={isHovered ? ButtonColor.RedOutline : ButtonColor.White}
          onClick={handleRemoveFriend}
          className="!h-9 transition-all duration-100"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isHovered ? "  Remove friend  " : "Friends"}
        </Button>
      );
    default:
      throw new Error(`unknown friend status: ${status satisfies never}`);
  }
};

export default FriendRequestButton;
