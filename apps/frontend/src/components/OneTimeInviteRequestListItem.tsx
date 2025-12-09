import { OnetimeInviteRequestDto } from "@alliance/shared/client";
import CopyIcon from "@alliance/shared/ui/icons/CopyIcon";
import DeleteIcon from "@alliance/shared/ui/icons/DeleteIcon";

export type OneTimeInviteRequestListItemProps = {
  request: OnetimeInviteRequestDto;
} & (
  | {
      isLeader: true;
      onApprove: (requestId: number) => void;
      onReject: (requestId: number) => void;
      onDelete?: undefined;
    }
  | {
      isLeader: false;
      onApprove?: undefined;
      onReject?: undefined;
      onDelete: (requestId: number) => void;
    }
);

const OneTimeInviteRequestListItem = ({
  request,
  isLeader,
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

        {isLeader && (
          <div className="flex flex-row gap-3 items-center">
            <p className="text-gray-500">{request.id}</p>
            <div
              className="cursor-pointer active:scale-85 transition-all duration-100 hover:brightness-50"
              onClick={() => onApprove(request.id)}
            >
              <CopyIcon size="medium" fill="gray" />
            </div>
            <div
              className="cursor-pointer active:scale-85 transition-all duration-100 hover:brightness-50"
              onClick={() => onReject(request.id)}
            >
              <DeleteIcon size="medium" fill="gray" />
            </div>
          </div>
        )}
        {!isLeader && (
          <div
            className="cursor-pointer active:scale-85 transition-all duration-100 hover:brightness-50"
            onClick={() => onDelete(request.id)}
          >
            <DeleteIcon size="medium" fill="gray" />
          </div>
        )}
      </div>
      {request.inviteeDescription && (
        <p className="break-words text-zinc-500">{request.inviteeDescription}</p>
      )}
    </div>
  );
};

export default OneTimeInviteRequestListItem;
