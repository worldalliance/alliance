import type { CreateTagDto, TagDto } from "@alliance/shared/client/types.gen";
import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
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
import { TagFields } from "./TagFields";
import { NEW_TAG, type TagFormErrors, validateTag } from "./tagRules";

export function NewTagDialog({
  tags,
  create,
  onClose,
}: {
  tags: readonly TagDto[];
  create: (body: CreateTagDto) => Promise<TagDto>;
  onClose: () => void;
}) {
  const { success } = useToast();
  const [values, setValues] = useState(NEW_TAG);
  const [errors, setErrors] = useState<TagFormErrors>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validated = validateTag({
      values,
      otherNames: tags.map((tag) => tag.name),
      descriptionRequired: true,
    });
    if (!validated.ok) {
      setErrors(validated.error);
      focusFirstInvalid();
      return;
    }
    setRefusal(null);
    setCreating(true);
    try {
      const created = await create(validated.value);
      success("Tag created", created.name);
      onClose();
    } catch (error) {
      setRefusal(adminRefusalMessage(error, "Couldn't create the tag."));
      setCreating(false);
    }
  };

  return (
    <Modal onClose={onClose} dismissDisabled={creating} initialFocus={nameRef}>
      <form ref={formRef} onSubmit={(event) => void submit(event)} noValidate>
        <ModalHeader>
          <ModalTitle>New tag</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <TagFields
            values={values}
            errors={errors}
            nameRef={nameRef}
            onChange={(next) => {
              setValues(next);
              setErrors({});
            }}
          />
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={creating}
            >
              Create tag
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
