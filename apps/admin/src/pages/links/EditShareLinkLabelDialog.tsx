import { SHARE_URL_LABEL_MAX_LENGTH } from "@alliance/common/shareUrlLabel";
import type {
  ShareUrlAdminDto,
  ShareUrlKind,
} from "@alliance/shared/client/types.gen";
import { useRef, useState } from "react";
import Button, { ButtonVariant } from "../../ui/Button";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Field } from "../../ui/templates/Form";

// From invite-share-urls.service's findInvitesForUser: a member's Invites page
// lists every invite link they own, by label, and lets them edit it.
const MEMBER_SEES_LABEL: Record<ShareUrlKind, boolean> = {
  action: false,
  externalTarget: false,
  invite: true,
};

/** Renames a share link; the label changes nothing about the link. */
export function EditShareLinkLabelDialog({
  link,
  busy,
  refusal,
  onSave,
  onClose,
}: {
  link: ShareUrlAdminDto;
  busy: boolean;
  refusal: string | null;
  onSave: (label: string) => void;
  onClose: () => void;
}) {
  const firstField = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(link.label ?? "");
  const memberSees = MEMBER_SEES_LABEL[link.kind] && link.userId !== null;
  return (
    <Modal onClose={onClose} initialFocus={firstField} dismissDisabled={busy}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSave(label);
        }}
      >
        <ModalHeader>
          <ModalTitle>Edit label</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Field
            label="Label"
            help={
              memberSees
                ? "The member sees this label on their Invites page. The link stays the same."
                : "For staff only. The link stays the same."
            }
          >
            {(control) => (
              <Input
                {...control}
                ref={firstField}
                value={label}
                maxLength={SHARE_URL_LABEL_MAX_LENGTH}
                placeholder="Recruit's name"
                onChange={(event) => setLabel(event.target.value)}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant={ButtonVariant.Primary} type="submit" busy={busy}>
              Save label
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
