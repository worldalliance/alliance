import { OnetimeInviteRequestDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import DeleteIcon from "@alliance/shared/ui/icons/DeleteIcon";

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
        <div>
          <p className="break-words">{request.invitee}</p>
        </div>

        <div className="flex space-x-2 -my-1">
          {(type === "leader_pending" || type === "leader_rejected") && (
            <Button
              onClick={() => onApprove(request.id)}
              color={
                type === "leader_pending"
                  ? ButtonColor.Green
                  : ButtonColor.White
              }
            >
              Approve
            </Button>
          )}
          {type === "leader_pending" && (
            <Button
              onClick={() => onReject(request.id)}
              color={ButtonColor.White}
            >
              Reject
            </Button>
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
