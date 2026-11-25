import { useState } from "react";
import { useNavigate } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { projectHref } from "../../lib/hrefs";
import { useCreateProjectAdmin } from "../../lib/useProjectsAdmin";
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

/**
 * Creates a project, then opens it. From a standalone task, the project
 * starts with that task's name and takes the task in.
 */
export function NewProjectDialog({
  fromTask,
  onClose,
}: {
  fromTask?: { id: number; name: string };
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { success } = useToast();
  const [name, setName] = useState(fromTask?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const create = useCreateProjectAdmin({
    onSuccess: (created) => {
      success("Project created", created.name);
      void navigate(projectHref(created.id));
    },
    onError: (error) =>
      setRefusal(adminRefusalMessage(error, "Couldn't create the project.")),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter a name");
      focusFirstInvalid();
      return;
    }
    setRefusal(null);
    create.mutate({ name: trimmed, actionId: fromTask?.id });
  };

  return (
    <Modal onClose={onClose} dismissDisabled={create.isPending}>
      <form ref={formRef} onSubmit={submit} noValidate>
        <ModalHeader>
          <ModalTitle>New project</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Field
            label="Name"
            error={nameError}
            help={
              fromTask
                ? `The task "${fromTask.name}" moves into the new project. Members see a project's name on each of its tasks.`
                : "Members see a project's name on each of its tasks."
            }
          >
            {(control) => (
              <Input
                {...control}
                value={name}
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
              Create project
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
