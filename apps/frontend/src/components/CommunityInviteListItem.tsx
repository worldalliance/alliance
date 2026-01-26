import { CommunityInviteDto } from "@alliance/shared/client";
import DeleteIcon from "@alliance/sharedweb/ui/icons/DeleteIcon";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";

export interface CommunityInviteListItemProps {
  invite: CommunityInviteDto;
  onDelete: (inviteId: number) => void;
}

const CommunityInviteListItem = ({
  invite,
  onDelete,
}: CommunityInviteListItemProps) => {
  return (
    <div
      key={invite.id}
      className="flex flex-row gap-x-2 p-4 justify-between items-center"
    >
      {invite.invitedUser && (
        <div className="flex flex-row gap-x-2 items-center">
          <ProfileImage pfp={invite.invitedUser.profilePicture} size="medium" />
          <p>{invite.invitedUser.displayName}</p>
        </div>
      )}
      <div className="flex flex-row gap-3 items-center">
        {invite.status === "pending" ? (
          <p className="text-green">Pending</p>
        ) : invite.status === "accepted" ? (
          <p className="text-zinc-500">Accepted</p>
        ) : invite.status === "rejected" ? (
          <p className="text-red-400">Rejected</p>
        ) : (
          <p className="text-zinc-500">Cancelled</p>
        )}
        <div
          className="cursor-pointer active:scale-85 transition-all duration-100 hover:brightness-50"
          onClick={() => onDelete(invite.id)}
        >
          <DeleteIcon size="medium" fill="gray" />
        </div>
      </div>
    </div>
  );
};

export default CommunityInviteListItem;
