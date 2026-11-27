import { errorMessage } from "@alliance/common/errorMessage";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Plus } from "lucide-react";
import React, { useState } from "react";
import ProjectCardTile from "../components/ProjectCardTile";
import { ProjectNameInput } from "../components/ProjectNameInput";
import { primaryButtonClass } from "../components/ui/controlStyles";
import PageShell, { PageWidth } from "../components/ui/PageShell";
import Section from "../components/ui/Section";
import {
  buildProjectCards,
  cardsByLifecycle,
  PROJECT_LIFECYCLE_ORDER,
  ProjectLifecycle,
} from "../lib/projectCards";
import { useCreateProjectAdmin } from "../lib/useProjectsAdmin";
import { ProjectsLoad, useProjectsPageData } from "../lib/useProjectsPageData";

const SECTION_TITLES: Record<ProjectLifecycle, string> = {
  [ProjectLifecycle.Live]: "Live",
  [ProjectLifecycle.Upcoming]: "Upcoming",
  [ProjectLifecycle.InTheWorks]: "In the works",
  [ProjectLifecycle.Awaiting]: "Awaiting office/resolution",
  [ProjectLifecycle.Done]: "Done",
};

const COLLAPSIBLE: Record<ProjectLifecycle, boolean> = {
  [ProjectLifecycle.Live]: false,
  [ProjectLifecycle.Upcoming]: false,
  [ProjectLifecycle.InTheWorks]: false,
  [ProjectLifecycle.Awaiting]: false,
  [ProjectLifecycle.Done]: true,
};

const NewProject = () => {
  const toast = useToast();
  const [naming, setNaming] = useState(false);
  const create = useCreateProjectAdmin({
    onSuccess: () => setNaming(false),
    onError: (error) =>
      toast.error(
        errorMessage({ error, fallback: "Could not create the project" }),
      ),
  });
  return naming ? (
    <ProjectNameInput
      initialName=""
      placeholder="New project name"
      saving={create.isPending}
      onSave={(name) => create.mutate({ name })}
      onCancel={() => setNaming(false)}
    />
  ) : (
    <button
      type="button"
      className={primaryButtonClass}
      onClick={() => setNaming(true)}
    >
      <Plus size={14} aria-hidden />
      New project
    </button>
  );
};

const ProjectsPage: React.FC = () => {
  const data = useProjectsPageData();
  const body = () => {
    switch (data.load) {
      case ProjectsLoad.Failed:
        return (
          <p role="alert" className="text-sm text-red-600">
            {data.error}
          </p>
        );
      case ProjectsLoad.Pending:
        return <p className="text-sm text-zinc-600">Loading projects…</p>;
      case ProjectsLoad.Ready:
        break;
      default:
        throw new Error(`unknown load: ${data satisfies never}`);
    }
    const sections = cardsByLifecycle(
      buildProjectCards({
        projects: data.projects,
        actions: data.actions,
        now: new Date(),
      }),
    );
    const shown = PROJECT_LIFECYCLE_ORDER.filter(
      (lifecycle) => sections[lifecycle].length > 0,
    );
    if (shown.length === 0) {
      return (
        <p className="text-sm text-zinc-600">
          No projects or actions yet. Create a project to group actions.
        </p>
      );
    }
    return shown.map((lifecycle) => (
      <Section
        key={lifecycle}
        title={SECTION_TITLES[lifecycle]}
        meta={sections[lifecycle].length}
        collapsible={
          COLLAPSIBLE[lifecycle] ? { defaultOpen: false } : undefined
        }
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(420px,1fr))] gap-4">
          {sections[lifecycle].map((card) => (
            <ProjectCardTile
              key={card.key}
              card={card}
              participantsById={data.participantsById}
            />
          ))}
        </div>
      </Section>
    ));
  };

  return (
    <PageShell title="Projects" actions={<NewProject />} width={PageWidth.Full}>
      <div className="flex flex-col gap-6">{body()}</div>
    </PageShell>
  );
};

export default ProjectsPage;
