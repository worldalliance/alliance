import { OnetimeInviteDto } from "@alliance/shared/client";
import CopyIcon from "@alliance/shared/ui/icons/CopyIcon";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { href, Link } from "react-router";
import { X } from "lucide-react";

export interface OneTimeInviteLeaderListItemProps {
  type: "leader_self_invited" | "leader_member_invited";
  invite: OnetimeInviteDto;
  onDelete: (inviteId: number, e: React.MouseEvent<HTMLElement>) => void;
  onCopy: (code: string) => void;
}

const OneTimeInviteLeaderListItem = ({
  type,
  invite,
  onDelete,
  onCopy,
}: OneTimeInviteLeaderListItemProps) => {
  return (
    <div
      key={invite.id}
      className="flex flex-row gap-x-2 p-4 justify-between items-center"
    >
      <div className="gap-x-2 flex flex-row items-center">
        {type === "leader_member_invited" && invite.invitingUser && (
          <Link
            to={href("/member/:id", {
              id: invite.invitingUser.id.toString(),
            })}
            className="hover:underline gap-x-3"
          >
            <ProfileImage pfp={invite.invitingUser.profilePicture} />
          </Link>
        )}

        <span className="">
          {type === "leader_member_invited" && invite.invitingUser && (
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
        {(type === "leader_member_invited" ||
          type === "leader_self_invited") && (
          <p className="text-gray-500">{invite.code}</p>
        )}
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
