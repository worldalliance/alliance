import { R } from "@alliance/common/result";
import { ActionDto, CreateActionDto } from "@alliance/shared/client";
import type { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { useCreateFormAdmin } from "@alliance/shared/lib/useFormsAdmin";
import { useAdminTaskFormActions } from "@alliance/shared/lib/useTaskForm";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { duplicatedActionImages } from "../../lib/actionImages";
import { imageUploadingMessage, logActionError } from "./actionSaveErrors";

export const useNavigateToCreatedAction = () => {
  const navigate = useNavigate();
  return useCallback(
    (action: ActionDto) => {
      navigate(`/actions/${action.id}`);
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
  const { confirm, success } = useToast();

  const handleDuplicate = useCallback(async () => {
    if (imageUploading) {
      setError(imageUploadingMessage);
      return;
    }

    let taskFormId = form.taskFormId;
    if (taskFormId) {
      const failed = logActionError(
        "Failed to duplicate the action's task form",
      );
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
      logActionError("Failed to duplicate action"),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Edits made while the copy was created hold the navigation at the leave
    // prompt, so the copy is announced on its own.
    success("Action duplicated");
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
    const confirmed =
      action?.archived ||
      (await confirm({
        title: "Archive this action?",
        message: `${action?.publicOnly ? "Its public page stays open to anyone with the link." : "Only admins can open it."} It also leaves the actions list unless archived actions are shown.`,
        confirmLabel: "Archive",
      }));
    if (confirmed && actionId) {
      const archived = action?.archived;
      const result = await R.fromPromise(
        archived ? unarchiveAction() : archiveAction(),
      );
      if (!result.ok) {
        setError(`Failed to ${archived ? "unarchive" : "archive"} action`);
        console.error(result.error);
      }
    }
  }, [
    actionId,
    action?.archived,
    action?.publicOnly,
    confirm,
    archiveAction,
    unarchiveAction,
    setError,
  ]);

  return { handleDuplicate, handleArchive };
}
