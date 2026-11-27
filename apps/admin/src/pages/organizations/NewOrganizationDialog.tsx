import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useCreateCampaignAdmin } from "../../lib/useCampaignsAdmin";
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
import { useToast } from "../../ui/ToastProvider";

export function NewOrganizationDialog({ onClose }: { onClose: () => void }) {
  const { success } = useToast();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const create = useCreateCampaignAdmin({
    onSuccess: (created) => {
      success("Organization created", created.name);
      onClose();
    },
    onError: (error) =>
      setRefusal(
        adminRefusalMessage(error, "Couldn't create the organization."),
      ),
  });

  return (
    <Modal
      onClose={onClose}
      dismissDisabled={create.isPending}
      initialFocus={nameRef}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) {
            setNameError("Enter a name");
            return;
          }
          setRefusal(null);
          create.mutate({ name: trimmed, kind: "organization" });
        }}
      >
        <ModalHeader>
          <ModalTitle>New organization</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Field label="Name" error={nameError}>
            {(control) => (
              <Input
                {...control}
                ref={nameRef}
                value={name}
                readOnly={create.isPending}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(null);
                }}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={create.isPending}
            >
              Create organization
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
