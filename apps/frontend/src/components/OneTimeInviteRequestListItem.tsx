import { OnetimeInviteRequestDto } from "@alliance/shared/client";
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
    <div className="p-4">
      <div
        key={request.id}
        className="flex flex-row gap-x-2 justify-between items-center"
      >
        {(type === "leader_rejected" || type === "leader_pending") && (
          <div className="flex break-words items-center">
            <Link
              to={href("/member/:id", {
                id: request.invitingUser.id.toString(),
              })}
              className="flex flex-2 items-center hover:underline gap-x-3"
            >
              <ProfileImage pfp={request.invitingUser.profilePicture} />
              <p>{request.invitingUser.displayName}</p>
            </Link>
            <span>{`'s request for: ${request.invitee}`}</span>
          </div>
        )}
        {type === "member" && (
          <div className="break-words">{request.invitee}</div>
        )}

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
        <p className="break-words text-zinc-500">
          {request.inviteeDescription}
        </p>
      )}
    </div>
  );
};

export default OneTimeInviteRequestListItem;
