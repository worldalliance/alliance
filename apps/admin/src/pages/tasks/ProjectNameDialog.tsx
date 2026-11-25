import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import {
  useCreateProjectAdmin,
  useUpdateProjectAdmin,
} from "../../lib/useProjectsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Field, useFocusFirstInvalid } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";

export type ProjectNameTarget =
  | { kind: "rename"; project: { id: number; name: string } }
  | { kind: "create"; actionId: number };

/** Renames the task's project, or creates a project and puts the task in it. */
export function ProjectNameDialog({
  target,
  onClose,
}: {
  target: ProjectNameTarget;
  onClose: () => void;
}) {
  const { success } = useToast();
  const renaming = target.kind === "rename";
  const [name, setName] = useState(renaming ? target.project.name : "");
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const refuse = (fallback: string) => (cause: Error) =>
    setRefusal(adminRefusalMessage(cause, fallback));
  const create = useCreateProjectAdmin({
    onSuccess: (created) => {
      success("Project created", created.name);
      onClose();
    },
    onError: refuse("Couldn't create the project."),
  });
  const rename = useUpdateProjectAdmin({
    onSuccess: () => {
      success("Project renamed");
      onClose();
    },
    onError: refuse("Couldn't rename the project."),
  });
  const busy = create.isPending || rename.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name");
      focusFirstInvalid();
      return;
    }
    setRefusal(null);
    if (target.kind === "rename") {
      rename.mutate({ id: target.project.id, body: { name: trimmed } });
    } else {
      create.mutate({ name: trimmed, actionId: target.actionId });
    }
  };

  return (
    <Modal onClose={onClose} dismissDisabled={busy}>
      <form ref={formRef} noValidate onSubmit={submit}>
        <ModalHeader>
          <ModalTitle>{renaming ? "Rename project" : "New project"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Field
            label="Name"
            error={error}
            help={
              renaming
                ? "Every task in the project shows the new name."
                : "The task moves into the new project."
            }
          >
            {(control) => (
              <Input
                {...control}
                autoFocus
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button variant={ButtonVariant.Default} onClick={onClose}>
              Cancel
            </Button>
            <Button variant={ButtonVariant.Primary} type="submit" busy={busy}>
              {renaming ? "Rename project" : "Create project"}
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
