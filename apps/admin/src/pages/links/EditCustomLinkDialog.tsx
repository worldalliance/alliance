import type { CustomLinkDto } from "@alliance/shared/client";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useUpdateCustomLinkAdmin } from "../../lib/useCustomLinksAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { useFocusFirstInvalid } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import { CustomLinkFields } from "./CustomLinkFields";
import {
  customLinkChanges,
  type CustomLinkErrors,
  validateCustomLink,
} from "./customLinkRules";

/** Edits a custom link, asking first when the change breaks its path. */
export function EditCustomLinkDialog({
  link,
  onClose,
}: {
  link: CustomLinkDto;
  onClose: () => void;
}) {
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const [values, setValues] = useState({
    label: link.label,
    slug: `/${link.slug}`,
    destination: link.destination,
  });
  const [errors, setErrors] = useState<CustomLinkErrors>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [refusal, setRefusal] = useState<string | null>(null);
  const update = useUpdateCustomLinkAdmin({
    onError: (error) =>
      setRefusal(adminRefusalMessage(error, "Couldn't save the custom link.")),
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validated = validateCustomLink(values);
    if (!validated.ok) {
      setErrors(validated.error);
      focusFirstInvalid();
      return;
    }
    const body = customLinkChanges(link, validated.value);
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    if (body.slug !== undefined) {
      const confirmed = await confirm({
        title: `Change the path of “${link.label}”?`,
        message: `/${link.slug} stops working at once for everyone who has it, on flyers and QR codes included. Only /${body.slug} opens the destination from then on.`,
        confirmLabel: "Change path",
        destructive: true,
      });
      if (!confirmed) return;
    }
    setRefusal(null);
    update.mutate(
      { id: link.id, body },
      {
        onSuccess: () => {
          success("Custom link saved", validated.value.label);
          onClose();
        },
      },
    );
  };

  return (
    <Modal onClose={onClose} dismissDisabled={update.isPending}>
      <form ref={formRef} onSubmit={(event) => void submit(event)} noValidate>
        <ModalHeader>
          <ModalTitle>Edit custom link</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <CustomLinkFields
            readOnly={update.isPending}
            values={values}
            errors={errors}
            onChange={(next) => {
              setValues(next);
              setErrors({});
            }}
            destinationHelp={`Everyone who opens /${link.slug} goes here as soon as you save.`}
          />
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={update.isPending}
            >
              Save changes
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
