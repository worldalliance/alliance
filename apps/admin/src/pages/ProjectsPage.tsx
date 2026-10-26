import { errorMessage } from "@alliance/common/errorMessage";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import React, { useState } from "react";
import ProjectCardTile from "../components/ProjectCardTile";
import { ProjectNameInput } from "../components/ProjectNameInput";
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
      aria-label="New project"
      title="New project"
      className="rounded border border-gray-2 bg-white p-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
      onClick={() => setNaming(true)}
    >
      <Plus size={16} />
    </button>
  );
};

const ProjectsPage: React.FC = () => {
  const data = useProjectsPageData();
  const [expanded, setExpanded] = useState<ReadonlySet<ProjectLifecycle>>(
    () => new Set(),
  );
  switch (data.load) {
    case ProjectsLoad.Failed:
      return <p className="p-5 text-red-500">{data.error}</p>;
    case ProjectsLoad.Pending:
      return <p className="p-5">Loading projects...</p>;
    case ProjectsLoad.Ready:
      break;
    default:
      throw new Error(`unknown load: ${data satisfies never}`);
  }
  const { participantsById } = data;
  const sections = cardsByLifecycle(
    buildProjectCards({
      projects: data.projects,
      actions: data.actions,
      now: new Date(),
    }),
  );

  const toggle = (lifecycle: ProjectLifecycle) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(lifecycle)) next.add(lifecycle);
      return next;
    });

  return (
    <div className="flex flex-col gap-y-6 p-5">
      <title>Projects</title>
      <div className="flex items-center gap-x-3">
        <h1 className="text-lg font-bold">Projects</h1>
        <NewProject />
      </div>
      {PROJECT_LIFECYCLE_ORDER.filter(
        (lifecycle) => sections[lifecycle].length > 0,
      ).map((lifecycle) => {
        const cards = sections[lifecycle];
        const collapsible = COLLAPSIBLE[lifecycle];
        const open = !collapsible || expanded.has(lifecycle);
        const title = (
          <>
            {SECTION_TITLES[lifecycle]}
            <span className="ml-2 font-normal text-zinc-400">
              {cards.length}
            </span>
          </>
        );
        return (
          <section key={lifecycle} className="flex flex-col gap-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
              {collapsible ? (
                <button
                  type="button"
                  aria-expanded={open}
                  className="flex items-center gap-x-1 uppercase"
                  onClick={() => toggle(lifecycle)}
                >
                  {open ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                  {title}
                </button>
              ) : (
                title
              )}
            </h2>
            {open && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(420px,1fr))] gap-4">
                {cards.map((card) => (
                  <ProjectCardTile
                    key={card.key}
                    card={card}
                    participantsById={participantsById}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default ProjectsPage;
