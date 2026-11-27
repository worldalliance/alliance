import { errorMessage } from "@alliance/common/errorMessage";
import type { ProjectDto } from "@alliance/shared/client";
import { optionSections } from "@alliance/shared/forms/optionSections";
import { cn } from "@alliance/shared/styles/util";
import SearchableSelect from "@alliance/sharedweb/forms/SearchableSelect";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  useAssignActionProjectAdmin,
  useCreateProjectAdmin,
  useProjectsAdmin,
  useUpdateProjectAdmin,
} from "../lib/useProjectsAdmin";
import { ProjectNameInput } from "./ProjectNameInput";

const NO_PROJECT = "none";

enum EditMode {
  None = "none",
  Rename = "rename",
  Create = "create",
}

enum LoadAlert {
  Hidden = "hidden",
  Shown = "shown",
  HandingOff = "handing-off",
}

const buttonClassName =
  "flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900";

export function ActionProjectControls({
  actionId,
  project,
}: {
  actionId: number;
  project: ProjectDto | null;
}) {
  const toast = useToast();
  const labelId = useId();
  const [mode, setMode] = useState(EditMode.None);

  const {
    data: projects = [],
    isPending: projectsLoading,
    isLoadingError: projectsFailed,
    isSuccess: projectsLoaded,
    isFetching: projectsFetching,
    refetch: refetchProjects,
  } = useProjectsAdmin();

  const onError = (fallback: string) => (error: unknown) =>
    toast.error(errorMessage({ error, fallback }));

  const assign = useAssignActionProjectAdmin({
    onError: onError("Could not change the action's project"),
  });

  const create = useCreateProjectAdmin({
    onSuccess: () => setMode(EditMode.None),
    onError: onError("Could not create the project"),
  });

  const rename = useUpdateProjectAdmin({
    onSuccess: () => setMode(EditMode.None),
    onError: onError("Could not rename the project"),
  });

  // An errored query with no data goes back to pending on any refetch, the
  // window-focus one included, so the alert holding Try again stays up from
  // the first failure until the projects load, then hands focus to the select
  // it unlocked if Try again still has it. The select drops its disabled
  // attribute a render after its prop clears, so the focus waits a task.
  const [loadAlert, setLoadAlert] = useState(LoadAlert.Hidden);
  if (loadAlert === LoadAlert.Hidden && projectsFailed)
    setLoadAlert(LoadAlert.Shown);
  if (loadAlert === LoadAlert.Shown && projectsLoaded)
    setLoadAlert(LoadAlert.HandingOff);
  const selectRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (loadAlert !== LoadAlert.HandingOff) return;
    const timer = setTimeout(() => {
      if (document.activeElement === retryRef.current) {
        selectRef.current
          ?.querySelector<HTMLElement>("[role=combobox]")
          ?.focus();
      }
      setLoadAlert(LoadAlert.Hidden);
    });
    return () => clearTimeout(timer);
  }, [loadAlert]);
  const loadingAgain = projectsFetching || loadAlert === LoadAlert.HandingOff;

  const listed =
    project && !projects.some(({ id }) => id === project.id)
      ? [project, ...projects]
      : projects;

  switch (mode) {
    case EditMode.Rename:
      if (!project) return null;
      return (
        <ProjectNameInput
          initialName={project.name}
          placeholder="Project name"
          saving={rename.isPending}
          onSave={(name) => rename.mutate({ id: project.id, body: { name } })}
          onCancel={() => setMode(EditMode.None)}
        />
      );
    case EditMode.Create:
      return (
        <ProjectNameInput
          initialName=""
          placeholder="New project name"
          saving={create.isPending}
          onSave={(name) => create.mutate({ name, actionId })}
          onCancel={() => setMode(EditMode.None)}
        />
      );
    case EditMode.None:
      break;
    default:
      throw new Error(`unknown mode: ${mode satisfies never}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id={labelId} className="w-16 text-sm text-zinc-600">
        Project
      </span>
      <div ref={selectRef} className="w-64">
        <SearchableSelect
          labelId={labelId}
          sections={optionSections({
            options: [
              { value: NO_PROJECT, label: "No project" },
              ...listed.map((p) => ({ value: String(p.id), label: p.name })),
            ],
          })}
          value={project ? String(project.id) : NO_PROJECT}
          onChange={(value) =>
            assign.mutate({
              actionId,
              projectId: value === NO_PROJECT ? null : Number(value),
            })
          }
          disabled={projectsLoading || projectsFailed || assign.isPending}
          className={cn(
            "border border-gray-2 rounded bg-white px-3 py-1.5 text-sm",
            !project && "text-zinc-500",
          )}
        />
      </div>
      {project && (
        <button
          type="button"
          className={buttonClassName}
          onClick={() => setMode(EditMode.Rename)}
        >
          <Pencil size={14} aria-hidden />
          Rename project
        </button>
      )}
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setMode(EditMode.Create)}
      >
        <Plus size={14} aria-hidden />
        New project
      </button>
      {loadAlert !== LoadAlert.Hidden && (
        <p
          role="alert"
          className={cn(
            "text-sm",
            loadingAgain ? "text-zinc-600" : "text-red-600",
          )}
        >
          {loadingAgain
            ? "Loading the projects…"
            : "Could not load the projects, so neither a project nor No project can be chosen."}{" "}
          <button
            ref={retryRef}
            type="button"
            aria-disabled={loadingAgain}
            className="underline hover:text-red-800 aria-disabled:opacity-50"
            onClick={() => {
              if (!loadingAgain) void refetchProjects();
            }}
          >
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
