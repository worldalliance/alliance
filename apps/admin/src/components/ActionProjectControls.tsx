import { errorMessage } from "@alliance/common/errorMessage";
import {
  projectsAssignActionAdmin,
  projectsCreateAdmin,
  projectsFindAllAdmin,
  projectsFindOneAdmin,
  projectsRemoveAdmin,
  projectsUpdateAdmin,
  type ActionCategory,
  type ProjectDto,
} from "@alliance/shared/client";
import { optionSections } from "@alliance/shared/forms/optionSections";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { cn } from "@alliance/shared/styles/util";
import SearchableSelect from "@alliance/sharedweb/forms/SearchableSelect";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { ActionCategoryPicker } from "./ActionCategoryIcons";
import ConfirmDialog from "./ConfirmDialog";

const NO_PROJECT = "none";

enum EditMode {
  None = "none",
  Rename = "rename",
  Create = "create",
}

const iconButtonClassName =
  "rounded border border-gray-2 bg-white p-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50";

function useInvalidateProjects(actionId: number) {
  const queryClient = useQueryClient();
  return (params?: { includeDetails: boolean }) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey:
          params?.includeDetails === false
            ? queryKeys.projectsAdmin()
            : queryKeys.projectsAdminAll(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionAdmin(actionId),
      }),
    ]);
}

function ProjectNameInput({
  initialName,
  placeholder,
  saving,
  onSave,
  onCancel,
}: {
  initialName: string;
  placeholder: string;
  saving: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialName);
  const trimmed = draft.trim();
  const save = () => {
    if (trimmed) onSave(trimmed);
  };
  return (
    <div className="flex flex-row items-center gap-1">
      <input
        type="text"
        aria-label={placeholder}
        placeholder={placeholder}
        className="w-64 border border-gray-2 rounded px-3 py-1.5 text-sm"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        // Read-only rather than disabled, so a failed save leaves focus here.
        readOnly={saving}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <Button
        color={ButtonColor.Blue}
        onClick={save}
        disabled={saving || !trimmed}
        className="!px-3 !text-sm"
      >
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button
        color={ButtonColor.White}
        onClick={onCancel}
        disabled={saving}
        className="!px-3 !text-sm"
      >
        Cancel
      </Button>
    </div>
  );
}

export function ActionProjectControls({
  actionId,
  project,
}: {
  actionId: number;
  project: ProjectDto | null;
}) {
  const toast = useToast();
  const labelId = useId();
  const invalidate = useInvalidateProjects(actionId);
  const [mode, setMode] = useState(EditMode.None);

  const { data: projects = [], isPending: projectsLoading } = useQuery({
    queryKey: queryKeys.projectsAdmin(),
    queryFn: () =>
      projectsFindAllAdmin({ throwOnError: true }).then((res) => res.data),
  });

  const onError = (fallback: string) => (error: unknown) =>
    toast.error(errorMessage({ error, fallback }));

  const assign = useMutation({
    mutationFn: (projectId: number | null) =>
      projectsAssignActionAdmin({
        path: { actionId },
        body: { projectId },
        throwOnError: true,
      }),
    onSuccess: () => invalidate(),
    onError: onError("Could not change the action's project"),
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { data: created } = await projectsCreateAdmin({
        body: { name },
        throwOnError: true,
      });
      await projectsAssignActionAdmin({
        path: { actionId },
        body: { projectId: created.id },
        throwOnError: true,
      });
    },
    onSuccess: async () => {
      await invalidate();
      setMode(EditMode.None);
    },
    onError: onError("Could not create the project"),
  });

  const rename = useMutation({
    mutationFn: (params: { id: number; name: string }) =>
      projectsUpdateAdmin({
        path: { id: params.id },
        body: { name: params.name },
        throwOnError: true,
      }),
    onSuccess: async () => {
      await invalidate();
      setMode(EditMode.None);
    },
    onError: onError("Could not rename the project"),
  });

  switch (mode) {
    case EditMode.Rename:
      if (!project) return null;
      return (
        <ProjectNameInput
          initialName={project.name}
          placeholder="Project name"
          saving={rename.isPending}
          onSave={(name) => rename.mutate({ id: project.id, name })}
          onCancel={() => setMode(EditMode.None)}
        />
      );
    case EditMode.Create:
      return (
        <ProjectNameInput
          initialName=""
          placeholder="New project name"
          saving={create.isPending}
          onSave={(name) => create.mutate(name)}
          onCancel={() => setMode(EditMode.None)}
        />
      );
    case EditMode.None:
      break;
    default:
      throw new Error(`unknown mode: ${mode satisfies never}`);
  }

  return (
    <div className="flex flex-row items-center gap-1">
      <span id={labelId} className="sr-only">
        Project
      </span>
      <div className="w-64">
        <SearchableSelect
          labelId={labelId}
          sections={optionSections({
            options: [
              { value: NO_PROJECT, label: "No project" },
              ...projects.map((p) => ({ value: String(p.id), label: p.name })),
            ],
          })}
          value={project ? String(project.id) : NO_PROJECT}
          onChange={(value) =>
            assign.mutate(value === NO_PROJECT ? null : Number(value))
          }
          disabled={projectsLoading || assign.isPending}
          className={cn(
            "border border-gray-2 rounded bg-white px-3 py-1.5 text-sm",
            !project && "text-zinc-500",
          )}
        />
      </div>
      {project && (
        <button
          type="button"
          aria-label="Rename project"
          title="Rename project"
          className={iconButtonClassName}
          onClick={() => setMode(EditMode.Rename)}
        >
          <Pencil size={14} />
        </button>
      )}
      <button
        type="button"
        aria-label="New project for this action"
        title="New project for this action"
        className={iconButtonClassName}
        onClick={() => setMode(EditMode.Create)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export function ActionProjectSteps({
  actionId,
  projectId,
}: {
  actionId: number;
  projectId: number;
}) {
  const toast = useToast();
  const invalidate = useInvalidateProjects(actionId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: project, error } = useQuery({
    queryKey: queryKeys.projectAdmin(projectId),
    queryFn: () =>
      projectsFindOneAdmin({
        path: { id: projectId },
        throwOnError: true,
      }).then((res) => res.data),
  });

  const remove = useMutation({
    mutationFn: () =>
      projectsRemoveAdmin({ path: { id: projectId }, throwOnError: true }),
    onSuccess: async () => {
      setConfirmingDelete(false);
      // The deleted project's detail query would refetch into a 404.
      await invalidate({ includeDetails: false });
    },
    onError: (error) =>
      toast.error(
        errorMessage({ error, fallback: "Could not delete the project" }),
      ),
  });

  const updateCategory = useMutation({
    mutationFn: (category: ActionCategory[]) =>
      projectsUpdateAdmin({
        path: { id: projectId },
        body: { category },
        throwOnError: true,
      }),
    onSuccess: () => invalidate(),
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
            onChange={(category) => updateCategory.mutate(category)}
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
                to={`/actions/${step.actionId}?tab=overview`}
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
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmingDelete(false)}
        isLoading={remove.isPending}
      />
    </div>
  );
}
