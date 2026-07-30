import { OnetimeInviteDto } from "@alliance/shared/client";
import { onetimeInviteStatusLabels } from "@alliance/shared/lib/copy";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { interactiveListRowClass } from "@alliance/sharedweb/ui/List";
import NewButton, { ButtonColor } from "@alliance/sharedweb/ui/NewButton";
import { Copy as CopyIcon } from "lucide-react";
import { href, Link } from "react-router";

type OnetimeInviteListItemProps = {
  invite: OnetimeInviteDto;
  showCommunityLabel?: boolean;
  communityLabel?: string | null;
  selfInvited: boolean;
  copied?: boolean;
  onCopy?: (code: string) => void;
  onCopied?: (inviteId: number) => void;
  onDelete?: (inviteId: number, event: React.MouseEvent<HTMLElement>) => void;
  /** Given for invites that can still be edited; makes the whole row open settings. */
  onOpenSettings?: (inviteId: number) => void;
  onApprove?: (inviteId: number) => void;
  onReject?: (inviteId: number) => void;
};

const STATUS_TEXT_CLASS: Record<
  keyof typeof onetimeInviteStatusLabels,
  string
> = {
  request_pending: "text-amber-500",
  request_rejected: "text-orange-600",
  link_used: "text-green",
  link_unused: "text-amber-500",
};

const OnetimeInviteListItem = ({
  invite,
  showCommunityLabel,
  communityLabel,
  selfInvited,
  copied = false,
  onCopy,
  onCopied,
  onDelete,
  onOpenSettings,
  onApprove,
  onReject,
}: OnetimeInviteListItemProps) => {
  const isRequest = invite.status === "request_pending";
  const statusLabel = onetimeInviteStatusLabels[invite.status];
  const textColorClass = STATUS_TEXT_CLASS[invite.status];
  communityLabel ??= "No group";

  const handleCopy = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onCopy?.(invite.code);
    onCopied?.(invite.id);
  };

  return (
    <div
      {...(onOpenSettings && {
        role: "button",
        tabIndex: 0,
        onClick: () => onOpenSettings(invite.id),
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenSettings(invite.id);
          }
        },
        "aria-label": `Settings for the invite to ${invite.invitee}`,
      })}
      className={cn(
        "flex flex-col sm:flex-row w-full justify-between p-4",
        onOpenSettings && interactiveListRowClass,
      )}
    >
      <div className="flex flex-col">
        {invite.invitedUserId ? (
          <Link
            to={href("/member/:id", {
              id: invite.invitedUserId.toString(),
            })}
            className="text-lg font-semibold text-zinc-900"
          >
            {invite.invitee}
          </Link>
        ) : (
          <span className="text-lg font-semibold text-zinc-900">
            {invite.invitee}
          </span>
        )}

        {invite.invitingUser && (
          <div className="text-sm flex flex-row items-center gap-x-1.5">
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
                <AvatarProfile
                  pfp={invite.invitingUser.profilePicture}
                  size="mini"
                />
                <span className="font-medium">
                  {invite.invitingUser.displayName}
                </span>
              </Link>
            )}
            <div className="text-zinc-400 text-sm">
              {formatTime(new Date(invite.createdAt), {
                addSuffix: true,
              })}
            </div>
          </div>
        )}
        {invite.inviteeDescription && (
          <AppMarkdownWrapper
            markdownContent={invite.inviteeDescription}
            className="break-words text-sm text-zinc-400"
          />
        )}
        {invite.info && (
          <AppMarkdownWrapper
            markdownContent={invite.info}
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
          <span className={cn("text-sm font-semibold", textColorClass)}>
            {statusLabel}
          </span>
        </div>
        <div className="mt-2 flex flex-row items-center sm:justify-end gap-2">
          {isRequest && onApprove && onReject ? (
            <>
              <NewButton
                onClick={(event) => {
                  event.stopPropagation();
                  onApprove(invite.id);
                }}
                color={ButtonColor.Green}
              >
                Approve
              </NewButton>
              <NewButton
                onClick={(event) => {
                  event.stopPropagation();
                  onReject(invite.id);
                }}
                color={ButtonColor.Red}
              >
                Reject
              </NewButton>
            </>
          ) : invite.status === "link_unused" ? (
            <>
              {onCopy && (
                <NewButton
                  color={copied ? ButtonColor.Green : ButtonColor.White}
                  disabled={copied}
                  onClick={handleCopy}
                  iconLeft={!copied && CopyIcon}
                >
                  {copied ? "Copied!" : "Share invite link"}
                </NewButton>
              )}
              {onDelete && !onOpenSettings && (
                <NewButton
                  color={ButtonColor.Black}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(invite.id, event);
                  }}
                >
                  Delete
                </NewButton>
              )}
            </>
          ) : (
            onDelete &&
            invite.status === "request_pending" && (
              <NewButton
                color={ButtonColor.White}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(invite.id, event);
                }}
              >
                Cancel
              </NewButton>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default OnetimeInviteListItem;
