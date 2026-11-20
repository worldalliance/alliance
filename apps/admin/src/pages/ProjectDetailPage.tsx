import { errorMessage } from "@alliance/common/errorMessage";
import { optionSections } from "@alliance/shared/forms/optionSections";
import SearchableSelect from "@alliance/sharedweb/forms/SearchableSelect";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Plus } from "lucide-react";
import React, { useId, useState } from "react";
import { useNavigate, useParams } from "react-router";
import ConfirmDialog from "../components/ConfirmDialog";
import NewProjectActionDialog from "../components/NewProjectActionDialog";
import ProjectCardBody, {
  ProjectCounts,
  projectSummary,
} from "../components/ProjectCardBody";
import ProjectDetails from "../components/ProjectDetails";
import ProjectWarnings from "../components/ProjectWarnings";
import { primaryButtonClass } from "../components/ui/controlStyles";
import PageShell from "../components/ui/PageShell";
import Section from "../components/ui/Section";
import { buildProjectCard, isProjectStep } from "../lib/projectCards";
import {
  useAssignActionProjectAdmin,
  useDeleteProjectAdmin,
  useStartStaffTestingAdmin,
} from "../lib/useProjectsAdmin";
import { ProjectsLoad, useProjectsPageData } from "../lib/useProjectsPageData";

const back = { to: "/projects", label: "Projects" };

const ProjectDetailPage: React.FC = () => {
  const projectId = Number(useParams().projectId);
  const toast = useToast();
  const navigate = useNavigate();
  const addLabelId = useId();
  const data = useProjectsPageData();
  const [creating, setCreating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const onError = (fallback: string) => (error: Error) =>
    toast.error(errorMessage({ error, fallback }));
  const startStaffTesting = useStartStaffTestingAdmin({
    onError: onError("Could not start staff testing"),
  });
  const assign = useAssignActionProjectAdmin({
    onError: onError("Could not change the action's project"),
  });
  const remove = useDeleteProjectAdmin({
    onSuccess: () => navigate("/projects"),
    onError: onError("Could not delete the project"),
  });

  switch (data.load) {
    case ProjectsLoad.Failed:
      return (
        <PageShell title="Project" back={back}>
          <p role="alert" className="text-sm text-red-600">
            {data.error}
          </p>
        </PageShell>
      );
    case ProjectsLoad.Pending:
      return (
        <PageShell title="Project" back={back}>
          <p className="text-sm text-zinc-600">Loading project…</p>
        </PageShell>
      );
    case ProjectsLoad.Ready:
      break;
    default:
      throw new Error(`unknown load: ${data satisfies never}`);
  }
  const { actions, projects, participantsById } = data;
  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    return (
      <PageShell title="Project not found" back={back}>
        <p className="text-sm text-zinc-600">It may have been deleted.</p>
      </PageShell>
    );
  }

  const card = buildProjectCard({ project, actions, now: new Date() });
  const addable = actions.filter(
    (action) => isProjectStep(action) && action.project?.id !== project.id,
  );

  return (
    <PageShell
      title={project.name}
      back={back}
      meta={<ProjectCounts card={card} />}
      description={projectSummary(card)}
      menu={[
        {
          label: "Delete project",
          onSelect: () => setConfirmingDelete(true),
          destructive: true,
        },
      ]}
    >
      <div className="flex flex-col gap-6">
        <ProjectWarnings flags={card.flags} defaultOpen />
        <Section
          title="Actions"
          meta={card.steps.length}
          actions={
            <>
              <span id={addLabelId} className="text-sm text-zinc-600">
                Add existing action
              </span>
              <div className="w-72">
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
                    assign.mutate({
                      actionId: Number(value),
                      projectId: project.id,
                    })
                  }
                  disabled={assign.isPending}
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm"
                />
              </div>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => setCreating(true)}
              >
                <Plus size={14} aria-hidden />
                New action
              </button>
            </>
          }
        >
          <ProjectCardBody
            card={card}
            participantsById={participantsById}
            detailed
            onRemoveStep={(step) =>
              assign.mutate({ actionId: step.id, projectId: null })
            }
            onStartStaffTesting={(step) => startStaffTesting.mutate(step.id)}
          />
        </Section>
        <ProjectDetails project={project} />
      </div>
      <NewProjectActionDialog
        projectId={project.id}
        open={creating}
        onClose={() => setCreating(false)}
      />
      <ConfirmDialog
        isOpen={confirmingDelete}
        title={`Delete project '${project.name}'?`}
        message={`Its ${card.steps.length} actions stay and become standalone.`}
        confirmLabel="Delete project"
        onConfirm={() => remove.mutate(project.id)}
        onCancel={() => setConfirmingDelete(false)}
        isLoading={remove.isPending}
      />
    </PageShell>
  );
};

export default ProjectDetailPage;
