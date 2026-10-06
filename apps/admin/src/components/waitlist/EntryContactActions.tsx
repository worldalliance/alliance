import { waitlistShareUrl } from "@alliance/common/waitlist";
import type {
  AdminWaitlistEntryDto,
  WaitlistInvitePlacement,
} from "@alliance/shared/client/types.gen";
import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { copyOutcome, CopyOutcome } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Modal, {
  ModalBody,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import { Copy, Link2, Ticket } from "lucide-react";
import React, { useState } from "react";
import { useRefusalToast } from "../../lib/useRefusalToast";
import { useInviteWaitlistEntryAdmin } from "../../lib/useWaitlistEntriesAdmin";
import { PLACEMENT_NOTES } from "../../lib/waitlistEmail";
import { SPAM_STATUSES } from "../../lib/waitlistFilter";
import { ICON_BUTTON_CLASS } from "./controlClasses";

const PLACEMENT_WARNINGS: Record<WaitlistInvitePlacement, string | null> = {
  group: null,
  ...PLACEMENT_NOTES,
};

const COPY_FEEDBACK: Record<CopyOutcome, React.ReactNode> = {
  [CopyOutcome.Copied]: <p className="text-xs text-green-700">Copied</p>,
  [CopyOutcome.Failed]: (
    <p className="text-xs text-red-600" role="alert">
      Couldn’t copy. Select the link and copy it yourself.
    </p>
  ),
};

const CopyableLink: React.FC<{ label: string; url: string }> = ({
  label,
  url,
}) => {
  const [copied, setCopied] = useState<CopyOutcome | null>(null);
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          readOnly
          aria-label={label}
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          title={`Copy ${label.toLowerCase()}`}
          className={ICON_BUTTON_CLASS}
          onClick={async () => setCopied(await copyOutcome(url))}
        >
          <Copy size={16} />
        </button>
      </div>
      {copied && COPY_FEEDBACK[copied]}
    </div>
  );
};

const LinkDialog: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, onClose, children }) => (
  <Modal open onClose={onClose} panelClassName="max-w-xl">
    <ModalHeader className="p-6">
      <ModalTitle render={<h3 />} className="text-lg font-medium">
        {title}
      </ModalTitle>
    </ModalHeader>
    <ModalBody className="space-y-3 px-6 pb-6 text-sm text-zinc-700">
      {children}
    </ModalBody>
  </Modal>
);

/** Lives outside the row, so a refetch that drops the entry keeps it open. */
export const InvitationDialog: React.FC<{
  entry: AdminWaitlistEntryDto;
  onClose: () => void;
}> = ({ entry, onClose }) => {
  const refusalToast = useRefusalToast();
  const invite = useInviteWaitlistEntryAdmin({
    onError: (err) => refusalToast(err, "Could not get a signup invitation."),
  });
  const notes = [
    entry.inviteState === "claimed"
      ? "An account already claimed an invitation of this entry."
      : null,
    entry.unsubscribedAt ? "This entry is unsubscribed." : null,
    SPAM_STATUSES[entry.spamStatus].spamLike
      ? `This entry is ${SPAM_STATUSES[entry.spamStatus].label.toLowerCase()}.`
      : null,
  ].filter((note) => note !== null);
  const placement = invite.data && PLACEMENT_WARNINGS[invite.data.placement];

  return (
    <LinkDialog title={`Signup invitation for ${entry.name}`} onClose={onClose}>
      <p>
        Lets {entry.name} create an account. Getting or copying it sends nothing
        and leaves mobilized status as it is; mark them mobilized once you reach
        them.
      </p>
      {notes.length > 0 && (
        <ul className="list-disc pl-5 text-amber-700">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {invite.data ? (
        <>
          <CopyableLink
            label="Signup invitation link"
            url={getOnetimeInviteSignupUrl(
              getInviteBaseUrl(),
              invite.data.code,
            )}
          />
          <p className="text-xs text-zinc-500">
            {invite.data.issued
              ? "Issued a new invitation."
              : "Reused the entry's unused invitation."}
          </p>
          {placement && (
            <p className="text-amber-700">
              This invitation has {placement}.
            </p>
          )}
        </>
      ) : (
        <Button
          color={ButtonColor.Black}
          size="small"
          disabled={invite.isPending}
          onClick={() => invite.mutate(entry.id)}
        >
          {invite.isPending ? "Getting…" : "Get signup invitation"}
        </Button>
      )}
    </LinkDialog>
  );
};

const EntryContactActions: React.FC<{
  entry: AdminWaitlistEntryDto;
  onInvite: () => void;
}> = ({ entry, onInvite }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex gap-1">
      <button
        type="button"
        aria-label={`Referral link for ${entry.name}`}
        title="Referral link"
        className={ICON_BUTTON_CLASS}
        onClick={() => setOpen(true)}
      >
        <Link2 size={16} />
      </button>
      <button
        type="button"
        aria-label={`Signup invitation for ${entry.name}`}
        title="Signup invitation"
        className={ICON_BUTTON_CLASS}
        onClick={onInvite}
      >
        <Ticket size={16} />
      </button>
      {open && (
        <LinkDialog
          title={`Referral link for ${entry.name}`}
          onClose={() => setOpen(false)}
        >
          <p>
            Others join the waitlist through it, credited to {entry.name}. It
            does not let anyone create an account.
          </p>
          <CopyableLink
            label="Referral link"
            url={waitlistShareUrl(getInviteBaseUrl(), entry.shareCode)}
          />
        </LinkDialog>
      )}
    </div>
  );
};

export default EntryContactActions;
