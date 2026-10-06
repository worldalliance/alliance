import { waitlistShareUrl } from "@alliance/common/waitlist";
import type { AdminWaitlistEntryDto } from "@alliance/shared/client/types.gen";
import { copyOutcome, CopyOutcome } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import Modal, {
  ModalBody,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import { Copy, Link2 } from "lucide-react";
import React, { useState } from "react";
import { ICON_BUTTON_CLASS } from "./controlClasses";

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

const EntryContactActions: React.FC<{ entry: AdminWaitlistEntryDto }> = ({
  entry,
}) => {
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
