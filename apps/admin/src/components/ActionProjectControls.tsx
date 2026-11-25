import { errorMessage } from "@alliance/common/errorMessage";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
  useDeleteProjectAdmin,
  useProjectAdmin,
  useUpdateProjectAdmin,
} from "../lib/useProjectsAdmin";
import Button, { ButtonColor } from "../ui/Button";
import { useToast } from "../ui/ToastProvider";
import { ActionCategoryPicker } from "./ActionCategoryIcons";
import ConfirmDialog from "./ConfirmDialog";

export function ActionProjectSteps({
  actionId,
  projectId,
}: {
  actionId: number;
  projectId: number;
}) {
  const toast = useToast();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: project, error } = useProjectAdmin(projectId);

  const remove = useDeleteProjectAdmin({
    onSuccess: () => setConfirmingDelete(false),
    onError: (error) =>
      toast.error(
        errorMessage({ error, fallback: "Could not delete the project" }),
      ),
  });

  const updateCategory = useUpdateProjectAdmin({
    onError: (error) =>
      toast.error(
        errorMessage({
          error,
          fallback: "Could not change the project's categories",
        }),
      ),
  });

  if (error) {
    return (
      <p className="text-sm text-red-600">
        {errorMessage({ error, fallback: "Could not load the project" })}
      </p>
    );
  }
  if (!project) return null;

  return (
    <div className="rounded border border-gray-2 bg-white p-3 text-sm">
      <div className="flex flex-row items-center justify-between gap-2 mb-2">
        <div className="flex flex-row items-center gap-2">
          <p className="font-medium">{project.name}</p>
          <ActionCategoryPicker
            value={project.category}
            onChange={(category) =>
              updateCategory.mutate({ id: projectId, body: { category } })
            }
            disabled={updateCategory.isPending}
          />
        </div>
        <Button
          color={ButtonColor.Red}
          onClick={() => setConfirmingDelete(true)}
          className="!px-2 !py-1 !text-xs gap-x-1"
        >
          <Trash2 size={12} />
          Delete project
        </Button>
      </div>
      <ol className="flex flex-col gap-1">
        {project.steps.map((step) => (
          <li key={step.actionId} className="flex flex-row gap-3">
            <span className="w-24 shrink-0 text-zinc-500">
              {step.memberActionAt
                ? format(new Date(step.memberActionAt), "MMM d, yyyy")
                : "Unscheduled"}
            </span>
            {step.actionId === actionId ? (
              <span className="font-medium">{step.actionName}</span>
            ) : (
              <Link
                to={`/tasks/${step.actionId}?tab=overview`}
                className="text-blue-600 hover:underline"
              >
                {step.actionName}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <ConfirmDialog
        isOpen={confirmingDelete}
        title={`Delete project "${project.name}"?`}
        message={`Its ${project.steps.length} action(s) will no longer belong to a project. The actions themselves are not deleted.`}
        onConfirm={() => remove.mutate(projectId)}
        onCancel={() => setConfirmingDelete(false)}
        isLoading={remove.isPending}
      />
    </div>
  );
}
