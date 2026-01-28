import { OnetimeInviteDto } from "@alliance/shared/client";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
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
            <ProfileImage
              pfp={request.invitingUser.profilePicture}
              size="small"
            />
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
            <span className="text-zinc-500">{" would like to invite "}</span>
            {request.invitee}
          </span>
        </div>

        <div className="flex space-x-2 -my-1">
          <Button
            onClick={() => onApprove(request.id)}
            color={ButtonColor.Green}
            className="!h-8 text-sm"
          >
            Approve
          </Button>
          <Button
            onClick={() => onReject(request.id)}
            color={ButtonColor.White}
            className="!h-8 text-sm"
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
