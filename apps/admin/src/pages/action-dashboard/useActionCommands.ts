import { R } from "@alliance/common/result";
import { ActionDto, CreateActionDto } from "@alliance/shared/client";
import type { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { useCreateFormAdmin } from "@alliance/shared/lib/useFormsAdmin";
import { useAdminTaskFormActions } from "@alliance/shared/lib/useTaskForm";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { LAUNCH_CONFIRM_TEXT } from "../../components/CreateEventForm";
import { duplicatedActionImages } from "../../lib/actionImages";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useToast } from "../../ui/ToastProvider";
import { unarchiveConsequence } from "../tasks/taskFacts";
import { imageUploadingMessage, logActionError } from "./actionSaveErrors";

export const useNavigateToCreatedAction = () => {
  const navigate = useNavigate();
  return useCallback(
    (action: ActionDto) => {
      navigate(`/tasks/${action.id}`);
    },
    [navigate],
  );
};

type ActionAdmin = ReturnType<typeof useActionAdmin>;

export function useActionCommands(params: {
  admin: Pick<
    ActionAdmin,
    "action" | "createAction" | "archiveAction" | "unarchiveAction"
  >;
  actionId: number | null;
  form: CreateActionDto;
  imageKey: string | null;
  imageUploading: boolean;
  setError: (error: string | null) => void;
}) {
  const {
    admin: { action, createAction, archiveAction, unarchiveAction },
    actionId,
    form,
    imageKey,
    imageUploading,
    setError,
  } = params;
  const { createForm } = useCreateFormAdmin();
  const { fetchLatest } = useAdminTaskFormActions();
  const handleActionCreated = useNavigateToCreatedAction();
  const confirm = useConfirmOnPage();
  const { success } = useToast();

  const handleDuplicate = useCallback(async () => {
    if (imageUploading) {
      setError(imageUploadingMessage);
      return;
    }

    let taskFormId = form.taskFormId;
    if (taskFormId) {
      const failed = logActionError("Couldn't copy the task's form.");
      const read = await fetchLatest(taskFormId);
      const copied = read.ok
        ? await R.fromPromise(
            createForm({
              title: read.value.title + " (Copy)",
              schema: read.value.schema,
            }),
            failed,
          )
        : R.failure(failed(read.error));
      if (!copied.ok) {
        setError(copied.error);
        return;
      }
      taskFormId = copied.value.id;
    }

    const duplicateForm = {
      ...form,
      name: `${form.name} (Copy)`,
      ...duplicatedActionImages({ form, action, imageKey }),
      taskFormId,
    };
    const result = await R.fromPromise(
      createAction(duplicateForm),
      logActionError("Couldn't duplicate the task."),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Edits made while the copy was created hold the navigation at the leave
    // prompt, so the copy is announced on its own.
    success("Task duplicated");
    handleActionCreated(result.value);
  }, [
    form,
    action,
    imageKey,
    imageUploading,
    createAction,
    createForm,
    fetchLatest,
    handleActionCreated,
    success,
    setError,
  ]);

  const handleArchive = useCallback(async () => {
    if (!action || !actionId) return;
    const { archived } = action;
    const unarchived = unarchiveConsequence(action, new Date());
    const confirmed = await confirm(
      archived
        ? {
            title: "Unarchive this task?",
            message: unarchived.message,
            confirmLabel: "Unarchive task",
            requiredText: unarchived.exposes ? LAUNCH_CONFIRM_TEXT : undefined,
          }
        : {
            title: "Archive this task?",
            message: `${action.publicOnly ? "Its public page stays open to anyone with the link." : "Only admins can open it."} It also leaves the tasks list unless archived tasks are shown.`,
            confirmLabel: "Archive task",
          },
    );
    if (!confirmed) return;
    const result = await R.fromPromise(
      archived ? unarchiveAction() : archiveAction(),
    );
    if (!result.ok) {
      console.error(result.error);
      setError(
        adminRefusalMessage(
          result.error,
          `Couldn't ${archived ? "unarchive" : "archive"} the task.`,
        ),
      );
    }
  }, [actionId, action, confirm, archiveAction, unarchiveAction, setError]);

  return { handleDuplicate, handleArchive };
}
