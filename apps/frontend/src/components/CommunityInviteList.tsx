import { CommunityInviteDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import List from "@alliance/sharedweb/ui/List";

type CommunityInviteListProps = {
  invites: CommunityInviteDto[];
  onAccept: (inviteId: number, anchor?: HTMLElement | null) => void;
  onDecline: (inviteId: number) => void;
};

const CommunityInviteList = ({
  invites,
  onAccept,
  onDecline,
}: CommunityInviteListProps) => (
  <List>
    {invites.map((invite) => (
      <div
        key={invite.id}
        className="flex flex-row gap-x-2 p-4 justify-between items-center"
      >
        <p>{invite.community.name}</p>
        <div className="flex flex-row gap-3 items-center">
          <Button
            onClick={(event) => onAccept(invite.id, event.currentTarget)}
            color={ButtonColor.Green}
          >
            Accept
          </Button>
          <Button
            onClick={() => onDecline(invite.id)}
            color={ButtonColor.Light}
          >
            Decline
          </Button>
        </div>
      </div>
    ))}
  </List>
);

export default CommunityInviteList;
