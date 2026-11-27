import { waitlistShareUrl } from "@alliance/common/waitlist";
import type {
  AdminWaitlistEntryDto,
  WaitlistInvitePlacement,
} from "@alliance/shared/client/types.gen";
import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import { useState, type ReactNode } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useInviteWaitlistEntryAdmin } from "../../lib/useWaitlistEntriesAdmin";
import { PLACEMENT_NOTES } from "../../lib/waitlistEmail";
import { SPAM_STATUSES } from "../../lib/waitlistFilter";
import Button, { ButtonVariant } from "../../ui/Button";
import { CopyField } from "../../ui/CopyField";
import InlineError from "../../ui/InlineError";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Banner, BannerTone } from "../../ui/templates/Banner";

const PLACEMENT_WARNINGS: Record<WaitlistInvitePlacement, string | null> = {
  group: null,
  ...PLACEMENT_NOTES,
};

function LinkDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal onClose={onClose} panelClassName="max-w-xl">
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-3">{children}</ModalBody>
      <ModalFooter>
        <ModalActions>
          <Button variant={ButtonVariant.Default} onClick={onClose}>
            Done
          </Button>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
}

export function ReferralLinkDialog({
  entry,
  onClose,
}: {
  entry: AdminWaitlistEntryDto;
  onClose: () => void;
}) {
  return (
    <LinkDialog title={`Referral link for ${entry.name}`} onClose={onClose}>
      <p>
        Others join the waitlist through it, credited to {entry.name}. It
        doesn't let anyone create an account.
      </p>
      <CopyField
        label="Referral link"
        value={waitlistShareUrl(getInviteBaseUrl(), entry.shareCode)}
      />
    </LinkDialog>
  );
}

/** Mounted outside the table, so a refetch that drops the entry keeps it open. */
export function InvitationDialog({
  entry,
  onClose,
}: {
  entry: AdminWaitlistEntryDto;
  onClose: () => void;
}) {
  const [refusal, setRefusal] = useState<string | null>(null);
  const invite = useInviteWaitlistEntryAdmin({
    onError: (err) =>
      setRefusal(adminRefusalMessage(err, "Couldn't get a signup invitation.")),
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
        <Banner tone={BannerTone.Warning} inline>
          <ul className="flex flex-col gap-1">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Banner>
      )}
      {invite.data ? (
        <>
          <CopyField
            label="Signup invitation link"
            value={getOnetimeInviteSignupUrl(
              getInviteBaseUrl(),
              invite.data.code,
            )}
          />
          <p className="text-fg-muted">
            {invite.data.issued
              ? "Issued a new invitation."
              : "Reused the entry's unused invitation."}
          </p>
          {placement && (
            <Banner tone={BannerTone.Warning} inline>
              This invitation has {placement}.
            </Banner>
          )}
        </>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <Button
            variant={ButtonVariant.Primary}
            busy={invite.isPending}
            onClick={() => {
              setRefusal(null);
              invite.mutate(entry.id);
            }}
          >
            Get signup invitation
          </Button>
          <InlineError message={refusal} />
        </div>
      )}
    </LinkDialog>
  );
}
