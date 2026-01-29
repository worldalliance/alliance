import {
  CommunityInviteDto,
  CommunityInviteStatus,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import { href, Link } from "react-router";

type CommunityInviteListItemProps = {
  invite: CommunityInviteDto;
  showCommunityLabel?: boolean;
  communityLabel?: string | null;
  selfInvited: boolean;
  onDelete?: (inviteId: number, event?: React.MouseEvent<HTMLElement>) => void;
};

const STATUS_STYLE = {
  accepted: { label: "Accepted", textStyle: "text-zinc-600" },
  rejected: { label: "Rejected", textStyle: "text-orange-600" },
  cancelled: { label: "Cancelled", textStyle: "text-zinc-500" },
  pending: { label: "Pending", textStyle: "text-green" },
} satisfies Record<CommunityInviteStatus, { label: string; textStyle: string }>;

const CommunityInviteListItem = ({
  invite,
  showCommunityLabel,
  communityLabel,
  selfInvited,
  onDelete,
}: CommunityInviteListItemProps) => {
  const statusStyle = STATUS_STYLE[invite.status];
  return (
    <div className="flex flex-row w-full justify-between p-4">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">
          <span className="text-zinc-600">Group invite</span>
          <span className="text-zinc-400">
            {showCommunityLabel && ` (${communityLabel ?? "No group"})`}
          </span>
        </div>
        {invite.invitedUser && (
          <Link
            to={href("/member/:id", {
              id: invite.invitedUser.id.toString(),
            })}
            className="flex flex-row items-center gap-x-2 hover:underline"
          >
            <ProfileImage
              pfp={invite.invitedUser.profilePicture}
              size="small"
            />
            <span className="font-semibold text-zinc-900">
              {invite.invitedUser.displayName}
            </span>
          </Link>
        )}
        {invite.invitingUser && (
          <div className="text-sm flex flex-row items-center gap-x-2">
            {selfInvited ? (
              "Invited by you"
            ) : (
              <>
                Invited by{" "}
                <Link
                  to={href("/member/:id", {
                    id: invite.invitingUser.id.toString(),
                  })}
                  className="hover:underline"
                >
                  <ProfileImage
                    pfp={invite.invitingUser.profilePicture}
                    size="small"
                  />
                  &nbsp;
                  <span className="font-medium">
                    {invite.invitingUser.displayName}
                  </span>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-between gap-2">
        <span className={`text-sm font-semibold ${statusStyle.textStyle}`}>
          {statusStyle.label}
        </span>
        <div className="flex flex-row items-center justify-end gap-2">
          {onDelete && (
            <Button
              color={ButtonColor.Black}
              onClick={(event) => onDelete(invite.id, event)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityInviteListItem;
