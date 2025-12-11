import { OnetimeInviteDto } from "@alliance/shared/client";
import AppMarkdownWrapper from "@alliance/shared/ui/AppMarkdownWrapper";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { href, Link } from "react-router";

export type OneTimeInviteRequestLeaderListItemProps = {
  request: OnetimeInviteDto;
  onApprove: (requestId: number) => void;
  onReject: (requestId: number) => void;
};

const OneTimeInviteRequestLeaderListItem = ({
  request,
  onApprove,
  onReject,
}: OneTimeInviteRequestLeaderListItemProps) => {
  return (
    <div className="p-4 gap-y-2 flex flex-col">
      <div
        key={request.id}
        className="flex flex-row gap-x-2 justify-between items-center"
      >
        <div className="flex flex-row gap-x-2 items-center">
          <Link
            to={href("/member/:id", {
              id: request.invitingUser.id.toString(),
            })}
          >
            <ProfileImage pfp={request.invitingUser.profilePicture} />
          </Link>

          <span className="break-words">
            <Link
              to={href("/member/:id", {
                id: request.invitingUser.id.toString(),
              })}
              className="hover:underline"
            >
              {request.invitingUser.displayName}
            </Link>
            <span className="text-gray-500">{" would like to invite "}</span>
            {request.invitee}
          </span>
        </div>

        <div className="flex space-x-2 -my-1">
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

export default OneTimeInviteRequestLeaderListItem;
