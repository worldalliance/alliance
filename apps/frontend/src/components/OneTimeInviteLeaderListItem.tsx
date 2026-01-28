import { OnetimeInviteDto } from "@alliance/shared/client";
import CopyIcon from "@alliance/sharedweb/ui/icons/CopyIcon";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import { href, Link } from "react-router";
import { X } from "lucide-react";

export interface OneTimeInviteLeaderListItemProps {
  leaderId: number | undefined;
  invite: OnetimeInviteDto;
  onDelete: (inviteId: number, e: React.MouseEvent<HTMLElement>) => void;
  onCopy: (code: string) => void;
}

const OneTimeInviteLeaderListItem = ({
  leaderId,
  invite,
  onDelete,
  onCopy,
}: OneTimeInviteLeaderListItemProps) => {
  const isSelfInvited = leaderId === invite.invitingUser.id;
  return (
    <div
      key={invite.id}
      className="flex flex-row gap-x-2 p-4 justify-between items-center"
    >
      <div className="gap-x-2 flex flex-row items-center">
        {!isSelfInvited && (
          <Link
            to={href("/member/:id", {
              id: invite.invitingUser.id.toString(),
            })}
            className="hover:underline gap-x-3 shrink-0"
          >
            <ProfileImage
              pfp={invite.invitingUser.profilePicture}
              size="medium"
            />
          </Link>
        )}

        <span className="">
          {!isSelfInvited && (
            <>
              <Link
                to={href("/member/:id", {
                  id: invite.invitingUser.id.toString(),
                })}
                className="items-center hover:underline gap-x-3"
              >
                <span>{invite.invitingUser.displayName}</span>
              </Link>
              <span className="text-gray-500">{" invited "}</span>
            </>
          )}
          {invite.invitee}
        </span>
      </div>

      <div className="flex flex-row gap-3 items-center">
        <p className="text-gray-500">{invite.code}</p>
        {invite.status === "link_used" ? (
          <p className="text-gray-500">Accepted</p>
        ) : (
          <>
            <p className="text-green">Pending</p>
            <div
              className="cursor-pointer active:scale-85 transition-all duration-100 hover:brightness-50"
              onClick={() => {
                onCopy(invite.code);
              }}
            >
              <CopyIcon size="medium" fill="gray" />
            </div>
            <div
              className="cursor-pointer active:scale-85 transition-all duration-100 hover:brightness-50"
              onClick={(e) => onDelete(invite.id, e)}
            >
              <X size={15} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OneTimeInviteLeaderListItem;
