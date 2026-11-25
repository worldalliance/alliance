import { useState } from "react";
import { useNavigate } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { projectTaskHref } from "../../lib/hrefs";
import { useCreateProjectActionAdmin } from "../../lib/useProjectsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Textarea } from "../../ui/Textarea";
import { Field, useFocusFirstInvalid } from "../../ui/templates/Form";

/** Creates a draft task in the project, then opens it. */
export function NewProjectTaskDialog({
  projectId,
  onClose,
}: {
  projectId: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    shortDescription?: string;
  }>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const create = useCreateProjectActionAdmin({
    onSuccess: (created) =>
      void navigate(projectTaskHref({ projectId, actionId: created.id })),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = {
      name: name.trim() ? undefined : "Enter a name",
      shortDescription: shortDescription.trim()
        ? undefined
        : "Enter a short description",
    };
    setErrors(next);
    if (next.name || next.shortDescription) {
      focusFirstInvalid();
      return;
    }
    setRefusal(null);
    create.mutate(
      {
        projectId,
        body: { name: name.trim(), shortDescription: shortDescription.trim() },
      },
      {
        onError: (error) =>
          setRefusal(adminRefusalMessage(error, "Couldn't create the task.")),
      },
    );
  };

  return (
    <Modal onClose={onClose} dismissDisabled={create.isPending}>
      <form ref={formRef} onSubmit={submit} noValidate>
        <ModalHeader>
          <ModalTitle>New task</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-fg-muted">
            The task starts as a draft, in a suite of its own with the same name
            and an empty task form. Members see nothing until it is released.
          </p>
          <Field label="Name" error={errors.name ?? null}>
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((was) => ({ ...was, name: undefined }));
                }}
              />
            )}
          </Field>
          <Field
            label="Short description"
            error={errors.shortDescription ?? null}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                value={shortDescription}
                onChange={(event) => {
                  setShortDescription(event.target.value);
                  setErrors((was) => ({ ...was, shortDescription: undefined }));
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
              Create task
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
