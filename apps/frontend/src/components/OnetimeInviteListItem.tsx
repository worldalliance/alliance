import { OnetimeInviteDto } from "@alliance/shared/client";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import { Copy } from "lucide-react";
import { useState } from "react";
import { href, Link } from "react-router";

type OnetimeInviteListItemProps = {
  invite: OnetimeInviteDto;
  showCommunityLabel?: boolean;
  communityLabel?: string | null;
  selfInvited: boolean;
  onCopy?: (code: string) => void;
  onDelete?: (inviteId: number, event: React.MouseEvent<HTMLElement>) => void;
  onApprove?: (inviteId: number) => void;
  onReject?: (inviteId: number) => void;
};

const STATUS_STYLE = {
  request_pending: {
    label: "Request pending",
    textColor: "text-amber-500",
  },
  request_rejected: {
    label: "Rejected",
    textColor: "text-orange-600",
  },
  link_used: { label: "Accepted", textColor: "text-zinc-600" },
  link_unused: { label: "Pending", textColor: "text-green" },
} satisfies Record<
  OnetimeInviteDto["status"],
  { label: string; textColor: string }
>;

const OnetimeInviteListItem = ({
  invite,
  showCommunityLabel,
  communityLabel,
  selfInvited,
  onCopy,
  onDelete,
  onApprove,
  onReject,
}: OnetimeInviteListItemProps) => {
  const isRequest = invite.status === "request_pending";
  const statusStyle = STATUS_STYLE[invite.status];
  const [copied, setCopied] = useState(false);
  communityLabel ??= "No group";

  const handleCopy = () => {
    onCopy?.(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  };

  return (
    <div className="flex flex-col sm:flex-row w-full justify-between p-4">
      <div className="flex flex-col">
        <span className="text-lg font-semibold text-zinc-900">
          {invite.invitee}
        </span>

        {invite.invitingUser && (
          <div className="text-sm flex flex-row items-center gap-x-2">
            {isRequest ? "Requested by" : "Invited by"}
            {selfInvited ? (
              " you"
            ) : (
              <Link
                to={href("/member/:id", {
                  id: invite.invitingUser.id.toString(),
                })}
                className="hover:underline flex flex-row items-center gap-x-1"
              >
                <ProfileImage
                  pfp={invite.invitingUser.profilePicture}
                  size="mini"
                />
                <span className="font-medium">
                  {invite.invitingUser.displayName}
                </span>
              </Link>
            )}
          </div>
        )}
        {invite.inviteeDescription && (
          <AppMarkdownWrapper
            markdownContent={invite.inviteeDescription}
            className="break-words text-sm text-zinc-400"
          />
        )}
      </div>

      <div className="mt-4 sm:mt-0 flex flex-col sm:items-end justify-between sm:gap-2">
        <div className="flex flex-row items-center gap-x-1.5">
          <div className="text-sm font-medium">
            {showCommunityLabel && (
              <span className="text-zinc-400">{communityLabel}</span>
            )}
          </div>
          <span className={`text-sm font-semibold ${statusStyle.textColor}`}>
            {statusStyle.label}
          </span>
        </div>
        <div className="mt-2 flex flex-row items-center sm:justify-end gap-2">
          {isRequest && onApprove && onReject ? (
            <>
              <Button
                onClick={() => onApprove(invite.id)}
                color={ButtonColor.Green}
              >
                Approve
              </Button>
              <Button
                onClick={() => onReject(invite.id)}
                color={ButtonColor.White}
              >
                Reject
              </Button>
            </>
          ) : invite.status === "link_unused" ? (
            <>
              {onCopy && (
                <Button
                  color={copied ? ButtonColor.Green : ButtonColor.White}
                  disabled={copied}
                  onClick={handleCopy}
                >
                  {copied ? (
                    "Copied!"
                  ) : (
                    <div className="flex flex-row items-center gap-x-2">
                      <Copy className="w-4 h-4" />
                      Share invite link
                    </div>
                  )}
                </Button>
              )}
              {onDelete && (
                <Button
                  color={ButtonColor.Black}
                  onClick={(event) => onDelete(invite.id, event)}
                >
                  Delete
                </Button>
              )}
            </>
          ) : (
            onDelete &&
            invite.status === "request_pending" && (
              <Button
                color={ButtonColor.White}
                onClick={(event) => onDelete(invite.id, event)}
              >
                Cancel
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default OnetimeInviteListItem;
