import { R } from "@alliance/common/result";
import {
  ActionDto,
  CreateActionDto,
  tasksCreateFormAdmin,
  tasksGetForm,
} from "@alliance/shared/client";
import type { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { useInvalidateFormsIndex } from "@alliance/shared/lib/useFormsAdmin";
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

const copyTaskForm = async (id: number): Promise<number> => {
  const { data: taskForm } = await tasksGetForm({
    path: { id },
    throwOnError: true,
  });
  const { data: copy } = await tasksCreateFormAdmin({
    body: { title: taskForm.title + " (Copy)", schema: taskForm.schema },
    throwOnError: true,
  });
  return copy.id;
};

export function useActionCommands(params: {
  admin: Pick<
    ActionAdmin,
    | "action"
    | "createAction"
    | "removeAction"
    | "archiveAction"
    | "unarchiveAction"
  >;
  actionId: number | null;
  form: CreateActionDto;
  imageKey: string | null;
  imageUploading: boolean;
  setError: (error: string | null) => void;
}) {
  const {
    admin: {
      action,
      createAction,
      removeAction,
      archiveAction,
      unarchiveAction,
    },
    actionId,
    form,
    imageKey,
    imageUploading,
    setError,
  } = params;
  const navigate = useNavigate();
  const invalidateFormsIndex = useInvalidateFormsIndex();
  const handleActionCreated = useNavigateToCreatedAction();

  const handleDuplicate = useCallback(async () => {
    if (imageUploading) {
      setError(imageUploadingMessage);
      return;
    }

    let taskFormId = form.taskFormId;
    if (taskFormId) {
      const copied = await R.fromPromise(
        copyTaskForm(taskFormId),
        logActionError("Failed to copy the action's task form"),
      );
      if (!copied.ok) {
        setError(copied.error);
        return;
      }
      taskFormId = copied.value;
      // The clone is a form row from here on, whether or not the action it
      // was made for gets created.
      await invalidateFormsIndex();
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
    handleActionCreated(result.value);
  }, [
    form,
    action,
    imageKey,
    imageUploading,
    createAction,
    handleActionCreated,
    invalidateFormsIndex,
    setError,
  ]);

  const handleActionDeleted = useCallback(() => {
    navigate("/actions");
  }, [navigate]);

  const { confirm } = useToast();

  const handleArchive = useCallback(async () => {
    const confirmed =
      action?.archived ||
      (await confirm({
        title: "Confirm Archive",
        message: "Are you sure you want to archive this action?",
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
    confirm,
    archiveAction,
    unarchiveAction,
    setError,
  ]);

  const handleDelete = async () => {
    if (!actionId) return;

    if (
      window.confirm(
        "Are you sure you want to delete this action? This cannot be undone.",
      )
    ) {
      const result = await R.fromPromise(removeAction());
      if (!result.ok) {
        setError("Failed to delete action");
        console.error(result.error);
        return;
      }
      handleActionDeleted();
    }
  };

  return { handleDuplicate, handleArchive, handleDelete };
}
