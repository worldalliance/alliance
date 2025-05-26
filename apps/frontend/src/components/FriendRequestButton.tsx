import { FriendStatusDto } from "@alliance/shared/client";
import Button from "./system/Button";
import icons8Plus from "../assets/icons8-plus.svg";
import { ButtonColor } from "./system/Button";

interface FriendRequestButtonProps {
  friendStatus: FriendStatusDto["status"];
  handleSendFriendRequest: () => void;
}

const FriendRequestButton = ({
  friendStatus,
  handleSendFriendRequest,
}: FriendRequestButtonProps) => {
  if (friendStatus === "none") {
    return (
      <Button
        color={ButtonColor.Blue}
        onClick={handleSendFriendRequest}
        className="rounded-full pl-3"
      >
        <img src={icons8Plus} alt="send" className="invert w-6 h-6" />
        <span className="mt-1">Send Friend Request</span>
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
        <span className="mt-1">Request sent!</span>
      </Button>
    );
  }
  return <span className="mt-1">Remove Friend</span>;
};

export default FriendRequestButton;
