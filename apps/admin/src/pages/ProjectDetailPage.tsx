import { errorMessage } from "@alliance/common/errorMessage";
import type { AdminProjectDto } from "@alliance/shared/client";
import { optionSections } from "@alliance/shared/forms/optionSections";
import SearchableSelect from "@alliance/sharedweb/forms/SearchableSelect";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import React, { useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ActionCategoryPicker } from "../components/ActionCategoryIcons";
import ConfirmDialog from "../components/ConfirmDialog";
import ProjectCardBody, {
  ProjectCounts,
  startedText,
} from "../components/ProjectCardBody";
import { ProjectNameInput } from "../components/ProjectNameInput";
import { buildProjectCard, isProjectStep } from "../lib/projectCards";
import {
  useAssignActionProjectAdmin,
  useDeleteProjectAdmin,
  useUpdateProjectAdmin,
} from "../lib/useProjectsAdmin";
import { ProjectsLoad, useProjectsPageData } from "../lib/useProjectsPageData";

enum EditField {
  None = "none",
  Name = "name",
  Slug = "slug",
}

const iconButtonClassName =
  "rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900";

const ProjectHeader = ({
  project,
  stepCount,
}: {
  project: AdminProjectDto;
  stepCount: number;
}) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(EditField.None);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const onError = (fallback: string) => (error: Error) =>
    toast.error(errorMessage({ error, fallback }));
  const update = useUpdateProjectAdmin({
    onSuccess: () => setEditing(EditField.None),
    onError: onError("Could not update the project"),
  });
  const remove = useDeleteProjectAdmin({
    onSuccess: () => navigate("/projects"),
    onError: onError("Could not delete the project"),
  });

  const field = (params: {
    field: EditField.Name | EditField.Slug;
    value: string;
    label: string;
    display: React.ReactNode;
  }) =>
    editing === params.field ? (
      <ProjectNameInput
        initialName={params.value}
        placeholder={params.label}
        saving={update.isPending}
        onSave={(value) =>
          update.mutate({
            id: project.id,
            body:
              params.field === EditField.Name
                ? { name: value }
                : { slug: value },
          })
        }
        onCancel={() => setEditing(EditField.None)}
      />
    ) : (
      <div className="flex items-center gap-x-1">
        {params.display}
        <button
          type="button"
          aria-label={`Edit ${params.label.toLowerCase()}`}
          title={`Edit ${params.label.toLowerCase()}`}
          className={iconButtonClassName}
          onClick={() => setEditing(params.field)}
        >
          <Pencil size={14} />
        </button>
      </div>
    );

  return (
    <div className="flex items-start justify-between gap-x-4">
      <div className="flex flex-col gap-y-1">
        <div className="flex items-center gap-x-3">
          {field({
            field: EditField.Name,
            value: project.name,
            label: "Project name",
            display: <h1 className="text-xl font-bold">{project.name}</h1>,
          })}
          <ActionCategoryPicker
            value={project.category}
            onChange={(category) =>
              update.mutate({ id: project.id, body: { category } })
            }
            disabled={update.isPending}
          />
        </div>
        {field({
          field: EditField.Slug,
          value: project.slug,
          label: "Project slug",
          display: (
            <span className="font-mono text-xs text-zinc-500">
              {project.slug}
            </span>
          ),
        })}
      </div>
      <Button
        color={ButtonColor.Red}
        onClick={() => setConfirmingDelete(true)}
        className="!px-2 !py-1 !text-xs gap-x-1"
      >
        <Trash2 size={12} />
        Delete project
      </Button>
      <ConfirmDialog
        isOpen={confirmingDelete}
        title={`Delete project '${project.name}'?`}
        message={`Its ${stepCount} actions stay and become standalone.`}
        confirmLabel="Delete project"
        onConfirm={() => remove.mutate(project.id)}
        onCancel={() => setConfirmingDelete(false)}
        isLoading={remove.isPending}
      />
    </div>
  );
};

const ProjectDetailPage: React.FC = () => {
  const projectId = Number(useParams().projectId);
  const toast = useToast();
  const addLabelId = useId();
  const data = useProjectsPageData();
  const assign = useAssignActionProjectAdmin({
    onError: (error) =>
      toast.error(
        errorMessage({
          error,
          fallback: "Could not change the action's project",
        }),
      ),
  });

  switch (data.load) {
    case ProjectsLoad.Failed:
      return <p className="p-5 text-red-500">{data.error}</p>;
    case ProjectsLoad.Pending:
      return <p className="p-5">Loading project...</p>;
    case ProjectsLoad.Ready:
      break;
    default:
      throw new Error(`unknown load: ${data satisfies never}`);
  }
  const { actions, projects, participantsById } = data;
  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    return (
      <div className="flex flex-col gap-y-2 p-5">
        <p className="text-red-500">Project not found.</p>
        <Link to="/projects" className="text-blue-600 hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const card = buildProjectCard({ project, actions, now: new Date() });
  const addable = actions.filter(
    (action) => isProjectStep(action) && action.project?.id !== project.id,
  );

  return (
    <div className="flex max-w-6xl flex-col gap-y-5 p-5">
      <title>{project.name}</title>
      <Link
        to="/projects"
        className="flex w-fit items-center gap-x-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} />
        Projects
      </Link>
      <ProjectHeader project={project} stepCount={card.steps.length} />
      <div className="flex items-center gap-x-3 text-sm text-zinc-500">
        <span>{startedText(card.startedAt)}</span>
        <ProjectCounts card={card} />
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <ProjectCardBody
          card={card}
          participantsById={participantsById}
          detailed
          onRemoveStep={(step) =>
            assign.mutate({ actionId: step.id, projectId: null })
          }
        />
      </div>
      <div className="flex items-center gap-x-2">
        <span id={addLabelId} className="text-sm text-zinc-600">
          Add action
        </span>
        <div className="w-96">
          <SearchableSelect
            labelId={addLabelId}
            sections={optionSections({
              options: addable.map((action) => ({
                value: String(action.id),
                label: action.project
                  ? `${action.name} (in ${action.project.name})`
                  : action.name,
              })),
            })}
            onChange={(value) =>
              assign.mutate({ actionId: Number(value), projectId: project.id })
            }
            disabled={assign.isPending}
            className="border border-gray-2 rounded bg-white px-3 py-1.5 text-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
