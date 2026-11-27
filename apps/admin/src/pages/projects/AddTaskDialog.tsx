import type {
  AdminActionListItemDto,
  AdminProjectDto,
} from "@alliance/shared/client";
import { optionSections } from "@alliance/shared/forms/optionSections";
import SearchableSelect from "@alliance/sharedweb/forms/SearchableSelect";
import { useId, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { isProjectStep } from "../../lib/projectCards";
import { useAssignActionProjectAdmin } from "../../lib/useProjectsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { controlClass } from "../../ui/styles";
import { useFocusFirstInvalid } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";

/**
 * Moves an existing task into the project; one in another project leaves
 * it. Archived and onboarding tasks are left out, as on the board.
 */
export function AddTaskDialog({
  project,
  actions,
  onClose,
}: {
  project: AdminProjectDto;
  actions: AdminActionListItemDto[];
  onClose: () => void;
}) {
  const labelId = useId();
  const { success } = useToast();
  const [picked, setPicked] = useState<string | undefined>();
  const [pickError, setPickError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const addable = actions.filter(
    (action) => isProjectStep(action) && action.project?.id !== project.id,
  );
  const pickedTask = addable.find((action) => String(action.id) === picked);
  const assign = useAssignActionProjectAdmin({
    onError: (error) =>
      setRefusal(adminRefusalMessage(error, "Couldn't add the task.")),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!pickedTask) {
      setPickError("Choose a task");
      focusFirstInvalid();
      return;
    }
    setRefusal(null);
    assign.mutate(
      { actionId: pickedTask.id, projectId: project.id },
      {
        onSuccess: () => {
          success("Task added", pickedTask.name);
          onClose();
        },
      },
    );
  };

  return (
    <Modal onClose={onClose} dismissDisabled={assign.isPending}>
      <form ref={formRef} onSubmit={submit} noValidate>
        <ModalHeader>
          <ModalTitle>Add task</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-1.5">
            <span id={labelId} className="font-medium">
              Task
            </span>
            <SearchableSelect
              labelId={labelId}
              sections={optionSections({
                options: addable.map((action) => ({
                  value: String(action.id),
                  label: action.project
                    ? `${action.name} (in ${action.project.name})`
                    : action.name,
                })),
              })}
              value={picked}
              onChange={(value) => {
                setPicked(value);
                setPickError(null);
              }}
              invalid={pickError !== null}
              disabled={assign.isPending}
              className={controlClass}
            />
            {pickError ? (
              <p role="alert" className="text-caption text-danger">
                {pickError}
              </p>
            ) : (
              <p className="text-caption text-fg-muted">
                {pickedTask?.project
                  ? `It leaves "${pickedTask.project.name}" for this project.`
                  : "A task in another project leaves it for this one."}
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={assign.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={assign.isPending}
            >
              Add task
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
