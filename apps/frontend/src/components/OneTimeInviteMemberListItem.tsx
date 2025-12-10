import { OnetimeInviteDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useCallback, useRef, useState } from "react";

export interface OneTimeInviteMemberListItemProps {
  invite: OnetimeInviteDto;
  onDelete: (inviteId: number, e: React.MouseEvent<HTMLElement>) => void;
  onCopy: (code: string) => void;
}

const OneTimeInviteMemberListItem = ({
  invite,
  onDelete,
  onCopy,
}: OneTimeInviteMemberListItemProps) => {
  const [copied, setCopied] = useState(false);
  const copiedResetTimeout = useRef<NodeJS.Timeout | null>(null);

  const setCopiedAndTimeout = useCallback(() => {
    setCopied(true);
    if (copiedResetTimeout.current) {
      clearTimeout(copiedResetTimeout.current);
    }
    copiedResetTimeout.current = setTimeout(() => {
      setCopied(false);
      copiedResetTimeout.current = null;
    }, 4000);
  }, [setCopied]);

  return (
    <div
      key={invite.id}
      className="flex flex-row gap-x-2 p-4 justify-between items-center"
    >
      <div className="gap-x-2 flex flex-row items-center">
        <span className="">{invite.invitee}</span>
      </div>

      <div className="flex flex-row gap-3 items-center">
        {invite.status === "link_used" ? (
          <p className="text-gray-500">Accepted</p>
        ) : (
          <>
            <Button
              onClick={() => {
                onCopy(invite.code);
                setCopiedAndTimeout();
              }}
              color={copied ? ButtonColor.Green : ButtonColor.Black}
            >
              {copied ? "Copied!" : "Share"}
            </Button>
            <Button
              onClick={(e) => onDelete(invite.id, e)}
              color={ButtonColor.Red}
            >
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default OneTimeInviteMemberListItem;
