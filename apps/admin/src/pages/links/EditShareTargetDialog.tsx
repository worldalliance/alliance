import type { ExternalShareTargetDto } from "@alliance/shared/client/types.gen";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useUpdateExternalShareTargetAdmin } from "../../lib/useExternalShareTargetsAdmin";
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
import { ShareTargetFields } from "./ShareTargetFields";
import {
  exampleShareLink,
  type ShareTargetErrors,
  validateShareTarget,
} from "./shareTargetRules";

/** Edits a share target, asking first when the change moves where its links go. */
export function EditShareTargetDialog({
  target,
  onClose,
}: {
  target: ExternalShareTargetDto;
  onClose: () => void;
}) {
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const [values, setValues] = useState({
    name: target.name,
    url: target.url,
    paramName: target.paramName,
  });
  const [errors, setErrors] = useState<ShareTargetErrors>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [refusal, setRefusal] = useState<string | null>(null);
  const update = useUpdateExternalShareTargetAdmin({
    onError: (error) =>
      setRefusal(adminRefusalMessage(error, "Couldn't save the share target.")),
  });
  const example = exampleShareLink(values);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validated = validateShareTarget(values);
    if (!validated.ok) {
      setErrors(validated.error);
      focusFirstInvalid();
      return;
    }
    const next = validated.value;
    if (next.url !== target.url || next.paramName !== target.paramName) {
      const confirmed = await confirm({
        title: `Change where “${target.name}” links to?`,
        message:
          "Links members have already copied or posted keep the old address: nothing can update those. Members who copy their link from now on get the new one.",
        confirmLabel: "Change link",
        destructive: true,
      });
      if (!confirmed) return;
    }
    setRefusal(null);
    update.mutate(
      { id: target.id, values: next },
      {
        onSuccess: () => {
          success("Share target saved", next.name);
          onClose();
        },
      },
    );
  };

  return (
    <Modal onClose={onClose} dismissDisabled={update.isPending}>
      <form ref={formRef} onSubmit={(event) => void submit(event)} noValidate>
        <ModalHeader>
          <ModalTitle>Edit share target</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <ShareTargetFields
            readOnly={update.isPending}
            values={values}
            errors={errors}
            onChange={(next) => {
              setValues(next);
              setErrors({});
            }}
          />
          <p className="min-h-lh text-caption break-all text-fg-muted">
            {example && (
              <>
                A member's link: <span className="font-mono">{example}</span>
              </>
            )}
          </p>
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
