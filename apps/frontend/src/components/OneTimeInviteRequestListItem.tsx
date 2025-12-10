import { OnetimeInviteRequestDto } from "@alliance/shared/client";
import AppMarkdownWrapper from "@alliance/shared/ui/AppMarkdownWrapper";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import DeleteIcon from "@alliance/shared/ui/icons/DeleteIcon";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { href, Link } from "react-router";

export type OneTimeInviteRequestListItemProps = {
  request: OnetimeInviteRequestDto;
} & (
  | {
      type: "leader_pending";
      onApprove: (requestId: number) => void;
      onReject: (requestId: number) => void;
      onDelete?: undefined;
    }
  | {
      type: "leader_rejected";
      onApprove: (requestId: number) => void;
      onReject?: undefined;
      onDelete?: undefined;
    }
  | {
      type: "member";
      onApprove?: undefined;
      onReject?: undefined;
      onDelete: (requestId: number) => void;
    }
);

const OneTimeInviteRequestListItem = ({
  request,
  type,
  onApprove,
  onReject,
  onDelete,
}: OneTimeInviteRequestListItemProps) => {
  return (
    <div className="p-4 gap-y-2 flex flex-col">
      <div
        key={request.id}
        className="flex flex-row gap-x-2 justify-between items-center"
      >
        <div className="flex flex-row gap-x-2 items-center">
          {(type === "leader_rejected" || type === "leader_pending") && (
            <Link
              to={href("/member/:id", {
                id: request.invitingUser.id.toString(),
              })}
            >
              <ProfileImage pfp={request.invitingUser.profilePicture} />
            </Link>
          )}
          <span className="break-words">
            {(type === "leader_rejected" || type === "leader_pending") && (
              <>
                <Link
                  to={href("/member/:id", {
                    id: request.invitingUser.id.toString(),
                  })}
                  className="hover:underline"
                >
                  {request.invitingUser.displayName}
                </Link>
                <span className="text-gray-500">
                  {" would like to invite "}
                </span>
              </>
            )}
            {request.invitee}
          </span>
        </div>

        <div className="flex space-x-2 -my-1">
          {type === "leader_rejected" && (
            <Button
              onClick={() => onApprove(request.id)}
              color={ButtonColor.White}
            >
              Approve
            </Button>
          )}
          {type === "leader_pending" && (
            <>
              <Button
                onClick={() => onApprove(request.id)}
                color={ButtonColor.Green}
              >
                Approve
              </Button>
              <Button
                onClick={() => onReject(request.id)}
                color={ButtonColor.White}
              >
                Reject
              </Button>
            </>
          )}
        </div>

        {type === "member" && (
          <div
            className="cursor-pointer active:scale-85 transition-all duration-100 hover:brightness-50"
            onClick={() => onDelete(request.id)}
          >
            <DeleteIcon size="medium" fill="gray" />
          </div>
        )}
      </div>
      {request.inviteeDescription && (
        <AppMarkdownWrapper
          markdownContent={request.inviteeDescription}
          className="break-words"
        />
      )}
    </div>
  );
};

export default OneTimeInviteRequestListItem;
