import { OnetimeInviteDto } from "@alliance/shared/client";
import AppMarkdownWrapper from "@alliance/shared/ui/AppMarkdownWrapper";
import { X } from "lucide-react";

export type OneTimeInviteRequestMemberListItemProps = {
  request: OnetimeInviteDto;
  onApprove?: undefined;
  onReject?: undefined;
  onDelete: (requestId: number) => void;
};

const OneTimeInviteRequestMemberListItem = ({
  request,
  onDelete,
}: OneTimeInviteRequestMemberListItemProps) => {
  return (
    <div className="p-4 gap-y-2 flex flex-col">
      <div
        key={request.id}
        className="flex flex-row gap-x-2 justify-between items-center"
      >
        <div className="flex flex-row gap-x-2 items-center break-words">
          {request.invitee}
        </div>

        <div
          className="cursor-pointer active:scale-85 transition-all duration-100 hover:brightness-50"
          onClick={() => onDelete(request.id)}
        >
          <X size={15} />
        </div>
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

export default OneTimeInviteRequestMemberListItem;
